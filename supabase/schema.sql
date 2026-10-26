-- Atlas pilot database. Run once in the Supabase SQL editor (Project → SQL Editor → New query),
-- then run migrate-login.sql (phone + password login checked by the database, test accounts).
-- User details live in `profiles`.
-- Business rules (who may approve, pay, settle...) run inside the database functions below.

-- ---------- Users ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique,
  name text not null,
  nic text not null default '',
  shop_name text not null default '',
  city text not null default '',
  role text not null check (role in ('mechanic', 'retailer', 'distributor', 'rm')),
  retailer_phone text,
  distributor_phone text,
  rm_phone text,
  photo_url text,
  created_at timestamptz not null default now()
);

create or replace function public.my_phone() returns text
language sql stable security definer set search_path = public
as $$ select phone from public.profiles where id = auth.uid() $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
create policy "members read profiles" on public.profiles for select to authenticated
  using ((select public.my_phone()) is not null);
create policy "rm adds users" on public.profiles for insert to authenticated
  with check ((select public.my_role()) = 'rm');
create policy "edit own profile or rm" on public.profiles for update to authenticated
  using (id = auth.uid() or (select public.my_role()) = 'rm');
-- Users may only change these columns themselves (not their role or links).
revoke update on public.profiles from authenticated, anon;
grant update (name, shop_name, city, photo_url) on public.profiles to authenticated;

-- ---------- Products (points per scan) ----------
create table if not exists public.products (sku text primary key, points int not null);
insert into public.products (sku, points) values
  ('CSK-CD70', 45), ('CSK-CD70M', 45), ('CSK-CD100', 45), ('CSK-CG125', 45),
  ('CCK-82L', 10), ('CCK-84L', 10)
on conflict (sku) do update set points = excluded.points;
alter table public.products enable row level security;
create policy "members read products" on public.products for select to authenticated using (true);

-- ---------- Scans and spins ----------
create sequence if not exists public.scan_seq start 100000001;
create table if not exists public.scans (
  id text primary key default 'CR-' || nextval('public.scan_seq'),
  code text not null unique,            -- each QR code is credited once, across all users
  sku text not null references public.products (sku),
  serial text not null,
  phone text not null,
  points int not null,
  created_at timestamptz not null default now()
);
alter table public.scans enable row level security;
create policy "own scans" on public.scans for select to authenticated
  using (phone = (select public.my_phone()));

create table if not exists public.spins (
  id bigint generated always as identity primary key,
  phone text not null,
  reward text,
  created_at timestamptz not null default now()
);
alter table public.spins enable row level security;
create policy "own spins" on public.spins for select to authenticated
  using (phone = (select public.my_phone()));

-- Credits a scanned QR code (ATLASDID|<SKU>|<serial>) to the signed-in mechanic or retailer.
create or replace function public.credit_scan(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_phone();
  v_code text := trim(p_code);
  parts text[] := string_to_array(trim(p_code), '|');
  prod public.products;
  found_scan public.scans;
  new_scan public.scans;
begin
  if me is null or public.my_role() not in ('mechanic', 'retailer') then
    raise exception 'Only mechanics and retailers can scan';
  end if;
  if coalesce(array_length(parts, 1), 0) <> 3 or parts[1] <> 'ATLASDID' or parts[3] = '' then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into prod from products where sku = parts[2];
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into found_scan from scans where scans.code = v_code;
  if found then
    if found_scan.phone = me then
      return jsonb_build_object('status', 'duplicate', 'scan', to_jsonb(found_scan));
    end if;
    return jsonb_build_object('status', 'used', 'at', found_scan.created_at);
  end if;
  insert into scans (code, sku, serial, phone, points)
  values (v_code, prod.sku, parts[3], me, prod.points) returning * into new_scan;
  return jsonb_build_object('status', 'added', 'scan', to_jsonb(new_scan));
end $$;

-- Authenticity check: whether a code has been scanned by anyone, and when.
create or replace function public.code_status(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('scanned', count(*) > 0, 'at', min(created_at))
  from scans where code = trim(p_code)
$$;

-- Uses one spin (1 per 10 scans, mechanics only) and records the reward (null = no prize).
create or replace function public.record_spin(p_reward text) returns public.spins
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_phone();
  row public.spins;
begin
  if public.my_role() <> 'mechanic' then raise exception 'Only mechanics can spin'; end if;
  if p_reward is not null and p_reward not in ('PKR 5', 'PKR 10', 'PKR 15', 'PKR 20') then
    raise exception 'Unknown reward';
  end if;
  if (select count(*) / 10 from scans where phone = me) <= (select count(*) from spins where phone = me) then
    raise exception 'No spins available';
  end if;
  insert into spins (phone, reward) values (me, p_reward) returning * into row;
  return row;
end $$;

-- ---------- Orders ----------
create sequence if not exists public.order_seq start 10000001;
create table if not exists public.orders (
  id text primary key default 'ORD-' || nextval('public.order_seq'),
  placed_by text not null,
  placed_by_role text not null check (placed_by_role in ('mechanic', 'retailer')),
  retailer text,
  rm text,
  distributor text,
  items jsonb not null,                 -- [{ sku, quantity, unitPrice? }]
  status text not null default 'placed'
    check (status in ('placed', 'approved', 'rejected', 'dispatched', 'delivered')),
  total numeric,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz
);
alter table public.orders enable row level security;
create policy "orders of my network" on public.orders for select to authenticated
  using ((select public.my_phone()) in (placed_by, retailer, rm, distributor));

create or replace function public.place_order(p_items jsonb) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  item jsonb;
  row public.orders;
begin
  select * into me from profiles where id = auth.uid();
  if me.role not in ('mechanic', 'retailer') then raise exception 'Only mechanics and retailers can order'; end if;
  if me.rm_phone is null then raise exception 'No Regional Manager is assigned to you yet'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'The order is empty'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from products where sku = item->>'sku')
       or (item->>'quantity')::int not between 1 and 999 then
      raise exception 'Invalid item in the order';
    end if;
  end loop;
  insert into orders (placed_by, placed_by_role, retailer, rm, distributor, items)
  values (me.phone, me.role, case when me.role = 'mechanic' then me.retailer_phone end,
          me.rm_phone, me.distributor_phone,
          (select jsonb_agg(jsonb_build_object('sku', i->>'sku', 'quantity', (i->>'quantity')::int))
             from jsonb_array_elements(p_items) i))
  returning * into row;
  return row;
end $$;

-- The RM approves (with a PKR unit price per SKU) or rejects a placed order.
create or replace function public.review_order(p_id text, p_decision text, p_prices jsonb default '{}')
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  dist text;
  priced jsonb;
begin
  select * into o from orders where id = p_id for update;
  if not found or o.rm <> public.my_phone() then raise exception 'This order was not sent to you'; end if;
  if o.status <> 'placed' then raise exception 'This order has already been reviewed'; end if;
  if p_decision = 'reject' then
    update orders set status = 'rejected', reviewed_at = now() where id = p_id returning * into o;
    return o;
  end if;
  if p_decision <> 'approve' then raise exception 'Unknown decision'; end if;
  select jsonb_agg(i || jsonb_build_object('unitPrice', (p_prices->>(i->>'sku'))::numeric))
    into priced from jsonb_array_elements(o.items) i;
  if exists (select 1 from jsonb_array_elements(priced) i
             where (i->>'unitPrice') is null or (i->>'unitPrice')::numeric <= 0) then
    raise exception 'Enter a price for every item';
  end if;
  dist := coalesce(o.distributor, (select distributor_phone from profiles where phone = o.placed_by));
  if dist is null then raise exception 'No distributor is assigned to this customer'; end if;
  update orders set status = 'approved', items = priced, distributor = dist, reviewed_at = now(),
    total = (select sum((i->>'unitPrice')::numeric * (i->>'quantity')::int) from jsonb_array_elements(priced) i)
  where id = p_id returning * into o;
  return o;
end $$;

-- The distributor dispatches an approved order, then marks it delivered.
create or replace function public.advance_order(p_id text, p_step text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from orders where id = p_id for update;
  if not found or o.distributor <> public.my_phone() then raise exception 'This order is not assigned to you'; end if;
  if p_step = 'dispatch' and o.status = 'approved' then
    update orders set status = 'dispatched', dispatched_at = now() where id = p_id returning * into o;
  elsif p_step = 'deliver' and o.status = 'dispatched' then
    update orders set status = 'delivered', delivered_at = now() where id = p_id returning * into o;
  else
    raise exception 'This order cannot be updated now';
  end if;
  return o;
end $$;

-- ---------- Claims ----------
create sequence if not exists public.claim_seq start 10000001;
create table if not exists public.claims (
  id text primary key default 'CLM-' || nextval('public.claim_seq'),
  from_phone text not null,
  to_phone text not null,
  routed_to text not null default 'rm',
  sku text not null references public.products (sku),
  quantity int not null check (quantity between 1 and 999),
  reason text not null check (length(reason) between 1 and 1000),
  photos text[] not null default '{}',
  tracking_id text,
  status text not null default 'pending'
    check (status in ('pending', 'in-review', 'approved', 'rejected', 'settled')),
  distributor text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  settled_at timestamptz
);
alter table public.claims enable row level security;
create policy "claims I filed, received or settle" on public.claims for select to authenticated
  using ((select public.my_phone()) in (from_phone, to_phone, distributor));

create or replace function public.file_claim(
  p_sku text, p_quantity int, p_reason text, p_photos text[] default '{}', p_tracking text default null
) returns public.claims
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  row public.claims;
begin
  select * into me from profiles where id = auth.uid();
  if me.role not in ('mechanic', 'retailer', 'distributor') then raise exception 'You cannot file claims'; end if;
  if me.rm_phone is null then raise exception 'No Regional Manager is assigned to you yet'; end if;
  insert into claims (from_phone, to_phone, sku, quantity, reason, photos, tracking_id)
  values (me.phone, me.rm_phone, p_sku, p_quantity, trim(p_reason), p_photos[1:4], nullif(trim(p_tracking), ''))
  returning * into row;
  return row;
end $$;

-- The RM approves (the claimant's distributor then settles it) or rejects; the distributor settles.
create or replace function public.decide_claim(p_id text, p_action text) returns public.claims
language plpgsql security definer set search_path = public as $$
declare
  c public.claims;
  claimant public.profiles;
  me text := public.my_phone();
begin
  select * into c from claims where id = p_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if p_action = 'settle' then
    if c.distributor <> me then raise exception 'This claim was not assigned to you'; end if;
    if c.status <> 'approved' then raise exception 'Only approved claims can be settled'; end if;
    update claims set status = 'settled', settled_at = now() where id = p_id returning * into c;
    return c;
  end if;
  if c.to_phone <> me then raise exception 'This claim was not sent to you'; end if;
  if c.status not in ('pending', 'in-review') then raise exception 'This claim has already been decided'; end if;
  if p_action = 'reject' then
    update claims set status = 'rejected', decided_at = now() where id = p_id returning * into c;
  elsif p_action = 'approve' then
    select * into claimant from profiles where phone = c.from_phone;
    update claims set status = 'approved', decided_at = now(),
      distributor = case when claimant.role = 'distributor' then claimant.phone else claimant.distributor_phone end
    where id = p_id returning * into c;
    if c.distributor is null then raise exception 'No distributor is assigned to this customer'; end if;
  else
    raise exception 'Unknown action';
  end if;
  return c;
end $$;

-- ---------- Redemptions ----------
create sequence if not exists public.redemption_seq start 10000001;
create table if not exists public.redemptions (
  id text primary key default 'RD-' || nextval('public.redemption_seq'),
  from_phone text not null,
  to_phone text not null,
  routed_to text not null check (routed_to in ('retailer', 'distributor', 'rm')),
  points int not null check (points > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  amount int,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.redemptions enable row level security;
create policy "redemptions I made or received" on public.redemptions for select to authenticated
  using ((select public.my_phone()) in (from_phone, to_phone));

-- Points a user can still redeem: scans + points received for paid requests - own open/paid requests.
create or replace function public.points_balance(p_phone text) returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(points) from scans where phone = p_phone), 0)
        + coalesce((select sum(points) from redemptions where to_phone = p_phone and status = 'paid'), 0)
        - coalesce((select sum(points) from redemptions where from_phone = p_phone and status <> 'rejected'), 0))::int
$$;

create or replace function public.request_redemption(p_routed_to text, p_points int) returns public.redemptions
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  recipient text;
  available int;
  row public.redemptions;
begin
  select * into me from profiles where id = auth.uid();
  recipient := case
    when p_routed_to = 'retailer' and me.role = 'mechanic' then me.retailer_phone
    when p_routed_to = 'distributor' and me.role in ('mechanic', 'retailer') then me.distributor_phone
    when p_routed_to = 'rm' and me.role in ('mechanic', 'retailer', 'distributor') then me.rm_phone
  end;
  if recipient is null then raise exception 'No one is assigned to receive your request'; end if;
  available := public.points_balance(me.phone);
  if p_points is null or p_points < 1 then raise exception 'Enter the number of points to redeem'; end if;
  if p_points > available then raise exception 'You can redeem up to % pts', greatest(available, 0); end if;
  insert into redemptions (from_phone, to_phone, routed_to, points)
  values (me.phone, recipient, p_routed_to, p_points) returning * into row;
  return row;
end $$;

-- The recipient pays a request (amount in PKR) or rejects it.
create or replace function public.decide_redemption(p_id text, p_action text, p_amount int default null)
returns public.redemptions
language plpgsql security definer set search_path = public as $$
declare r public.redemptions;
begin
  select * into r from redemptions where id = p_id for update;
  if not found or r.to_phone <> public.my_phone() then raise exception 'This request was not sent to you'; end if;
  if r.status <> 'pending' then raise exception 'This request has already been handled'; end if;
  if p_action = 'pay' then
    if p_amount is null or p_amount <= 0 then raise exception 'Enter the amount paid'; end if;
    update redemptions set status = 'paid', amount = p_amount, decided_at = now() where id = p_id returning * into r;
  elsif p_action = 'reject' then
    update redemptions set status = 'rejected', decided_at = now() where id = p_id returning * into r;
  else
    raise exception 'Unknown action';
  end if;
  return r;
end $$;

-- ---------- Chat ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation text not null,
  from_phone text not null,
  to_phone text not null,
  text text not null default '',
  attachment jsonb,
  created_at timestamptz not null default now(),
  check (conversation = case when from_phone collate "C" < to_phone collate "C"
                             then from_phone || '_' || to_phone else to_phone || '_' || from_phone end)
);
create index if not exists messages_conversation_idx on public.messages (conversation, created_at);
alter table public.messages enable row level security;
create policy "my messages" on public.messages for select to authenticated
  using ((select public.my_phone()) in (from_phone, to_phone));
create policy "send as myself" on public.messages for insert to authenticated
  with check (from_phone = (select public.my_phone()));

-- Latest message of each of my conversations.
create or replace function public.my_conversations()
returns table (conversation text, partner text, last jsonb)
language sql stable set search_path = public as $$
  select distinct on (m.conversation)
    m.conversation,
    case when m.from_phone = public.my_phone() then m.to_phone else m.from_phone end,
    jsonb_build_object('id', m.id, 'conversation', m.conversation, 'from', m.from_phone,
                       'to', m.to_phone, 'text', m.text, 'attachment', m.attachment, 'at', m.created_at)
  from messages m
  where public.my_phone() in (m.from_phone, m.to_phone)
  order by m.conversation, m.created_at desc
$$;

-- ---------- Files (claim photos, chat attachments) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 10485760)
on conflict (id) do nothing;
create policy "members upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (select public.my_phone()) is not null);

-- ---------- Promotions (managed by the RM) ----------
create table if not exists public.promos (
  id bigint generated always as identity primary key,
  image_url text not null,
  title text not null default '',
  active boolean not null default true,
  -- Roles that see the promo in the app.
  audience text[] not null default '{mechanic,retailer,distributor}'
    check (cardinality(audience) > 0 and audience <@ array['mechanic', 'retailer', 'distributor']),
  created_at timestamptz not null default now()
);
alter table public.promos enable row level security;
drop policy if exists "members read promos" on public.promos;
drop policy if exists "rm adds promos" on public.promos;
drop policy if exists "rm edits promos" on public.promos;
drop policy if exists "rm deletes promos" on public.promos;
create policy "members read promos" on public.promos for select to authenticated
  using ((select public.my_role()) = 'rm' or (select public.my_role()) = any (audience));
create policy "rm adds promos" on public.promos for insert to authenticated
  with check ((select public.my_role()) = 'rm');
create policy "rm edits promos" on public.promos for update to authenticated
  using ((select public.my_role()) = 'rm');
create policy "rm deletes promos" on public.promos for delete to authenticated
  using ((select public.my_role()) = 'rm');
do $$ begin
  alter publication supabase_realtime add table public.promos;
exception when duplicate_object then null;
end $$;

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.messages, public.orders, public.claims, public.redemptions;
