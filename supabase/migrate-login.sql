-- Login without email. Run once in the SQL editor (after schema.sql).
-- The app opens an anonymous Supabase session, then `login(phone, password)` checks the password
-- here and links that session to the user's phone. The RM adds users with `create_user`.

-- Profiles no longer belong to a Supabase Auth user.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();

-- Password hashes, never readable by the app.
create table if not exists public.credentials (
  phone text primary key references public.profiles (phone) on delete cascade,
  password_hash text not null
);
alter table public.credentials enable row level security;

-- Which phone each signed-in session belongs to.
create table if not exists public.sessions (
  uid uuid primary key references auth.users (id) on delete cascade,
  phone text not null references public.profiles (phone) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

create or replace function public.my_phone() returns text
language sql stable security definer set search_path = public
as $$ select phone from public.sessions where uid = auth.uid() $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public
as $$ select p.role from public.sessions s join public.profiles p on p.phone = s.phone where s.uid = auth.uid() $$;

drop policy if exists "rm adds users" on public.profiles;
drop policy if exists "edit own profile or rm" on public.profiles;
create policy "edit own profile" on public.profiles for update to authenticated
  using (phone = (select public.my_phone()));

-- Checks the password and links this session to the phone.
create or replace function public.login(p_phone text, p_password text) returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  hash text;
  prof public.profiles;
begin
  if auth.uid() is null then raise exception 'Not connected'; end if;
  select password_hash into hash from credentials where phone = p_phone;
  if hash is null or hash <> crypt(p_password, hash) then
    raise exception 'Phone number or password is incorrect.';
  end if;
  insert into sessions (uid, phone) values (auth.uid(), p_phone)
  on conflict (uid) do update set phone = excluded.phone, created_at = now();
  select * into prof from profiles where phone = p_phone;
  return prof;
end $$;

create or replace function public.logout() returns void
language sql security definer set search_path = public
as $$ delete from sessions where uid = auth.uid() $$;

-- The RM registers a mechanic, retailer or distributor in their region.
create or replace function public.create_user(
  p_phone text, p_password text, p_name text, p_role text,
  p_nic text default '', p_shop text default '', p_city text default '',
  p_retailer text default null, p_distributor text default null
) returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  me text := public.my_phone();
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  prof public.profiles;
begin
  if public.my_role() <> 'rm' then raise exception 'Only the Regional Manager can add users'; end if;
  if p_role not in ('mechanic', 'retailer', 'distributor') then raise exception 'Choose the role'; end if;
  if length(v_phone) < 3 then raise exception 'Enter a valid phone number'; end if;
  if length(coalesce(p_password, '')) < 3 then raise exception 'The password must be at least 3 characters'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Enter the name'; end if;
  if exists (select 1 from profiles where profiles.phone = v_phone) then
    raise exception 'This phone number is already registered.';
  end if;
  insert into profiles (phone, name, nic, shop_name, city, role, retailer_phone, distributor_phone, rm_phone)
  values (v_phone, trim(p_name), trim(coalesce(p_nic, '')), trim(coalesce(p_shop, '')), trim(coalesce(p_city, '')),
          p_role,
          case when p_role = 'mechanic' then p_retailer end,
          case when p_role <> 'distributor' then p_distributor end,
          me)
  returning * into prof;
  insert into credentials (phone, password_hash) values (v_phone, crypt(p_password, gen_salt('bf')));
  return prof;
end $$;

-- The RM sets a new password for a user in their region.
create or replace function public.reset_password(p_phone text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.my_role() <> 'rm'
     or not exists (select 1 from profiles where phone = p_phone and rm_phone = public.my_phone()) then
    raise exception 'You cannot change this password';
  end if;
  if length(coalesce(p_password, '')) < 3 then raise exception 'The password must be at least 3 characters'; end if;
  update credentials set password_hash = crypt(p_password, gen_salt('bf')) where phone = p_phone;
end $$;

-- Functions that looked the user up by auth id now use the session's phone.
create or replace function public.place_order(p_items jsonb) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  item jsonb;
  row public.orders;
begin
  select * into me from profiles where phone = public.my_phone();
  if me.role is null or me.role not in ('mechanic', 'retailer') then raise exception 'Only mechanics and retailers can order'; end if;
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

create or replace function public.file_claim(
  p_sku text, p_quantity int, p_reason text, p_photos text[] default '{}', p_tracking text default null
) returns public.claims
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  row public.claims;
begin
  select * into me from profiles where phone = public.my_phone();
  if me.role is null or me.role not in ('mechanic', 'retailer', 'distributor') then raise exception 'You cannot file claims'; end if;
  if me.rm_phone is null then raise exception 'No Regional Manager is assigned to you yet'; end if;
  insert into claims (from_phone, to_phone, sku, quantity, reason, photos, tracking_id)
  values (me.phone, me.rm_phone, p_sku, p_quantity, trim(p_reason), p_photos[1:4], nullif(trim(p_tracking), ''))
  returning * into row;
  return row;
end $$;

create or replace function public.request_redemption(p_routed_to text, p_points int) returns public.redemptions
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  recipient text;
  available int;
  row public.redemptions;
begin
  select * into me from profiles where phone = public.my_phone();
  recipient := case
    when p_routed_to = 'retailer' and me.role = 'mechanic' then me.retailer_phone
    when p_routed_to = 'distributor' and me.role in ('mechanic', 'retailer') then me.distributor_phone
    when p_routed_to = 'rm' and me.role in ('retailer', 'distributor') then me.rm_phone
  end;
  if recipient is null then raise exception 'No one is assigned to receive your request'; end if;
  available := public.points_balance(me.phone);
  if p_points is null or p_points < 1 then raise exception 'Enter the number of points to redeem'; end if;
  if p_points > available then raise exception 'You can redeem up to % pts', greatest(available, 0); end if;
  insert into redemptions (from_phone, to_phone, routed_to, points)
  values (me.phone, recipient, p_routed_to, p_points) returning * into row;
  return row;
end $$;

-- Only logged-in sessions may call the functions; balances are checked inside them.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.points_balance(text) from authenticated;

-- Test accounts. Login: 000/000 (mechanic), 111/111 (retailer), 222/222 (RM), 333/333 (distributor).
insert into public.profiles (phone, name, nic, shop_name, city, role, retailer_phone, distributor_phone, rm_phone)
values
  ('222', 'Faisal Ahmed', '222', 'Regional Office', 'Rawalpindi / Islamabad', 'rm', null, null, null),
  ('333', 'Kamran Distributors', '333', 'Kamran Distributors, I-9', 'Islamabad', 'distributor', null, null, '222'),
  ('111', 'Usman Traders', '111', 'Usman Traders, Raja Bazaar', 'Rawalpindi', 'retailer', null, '333', '222'),
  ('000', 'Ali Raza', '000', 'Star Autos, Main Bazaar', 'Rawalpindi', 'mechanic', '111', '333', '222')
on conflict (phone) do nothing;
insert into public.credentials (phone, password_hash)
select phone, extensions.crypt(phone, extensions.gen_salt('bf'))
from public.profiles where phone in ('000', '111', '222', '333')
on conflict (phone) do nothing;

-- Should list the 4 test users.
select phone, name, role from public.profiles order by phone;
