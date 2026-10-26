-- Retailers: authenticity check only (no points scan), points from delivered orders, and
-- rewards (gifts) instead of cash. Run once in the SQL editor.

-- Points a retailer earns per unit ordered (from the rewards poster).
alter table public.products add column if not exists order_points numeric not null default 0;
update public.products set order_points = case sku
  when 'CSK-CD70' then 7
  when 'CSK-CD70M' then 7
  when 'CSK-CG125' then 11
  when 'CSK-CD100' then 13
  when 'CCK-82L' then 2.5
  when 'CCK-84L' then 2.5
  else order_points end;

-- Points an order earns its retailer; credited when the order is delivered.
alter table public.orders add column if not exists points numeric not null default 0;

-- Gifts retailers can redeem their points for.
create table if not exists public.rewards (
  id int primary key,
  tier int not null,
  points int not null check (points > 0),
  title text not null,
  icon text not null default 'card-giftcard',
  active boolean not null default true
);
alter table public.rewards enable row level security;
drop policy if exists "members read rewards" on public.rewards;
create policy "members read rewards" on public.rewards for select to authenticated
  using ((select public.my_phone()) is not null);
insert into public.rewards (id, tier, points, title, icon) values
  (1, 1, 9000, 'LED TV 40 inch', 'tv'),
  (2, 1, 9000, 'Automatic Washing Machine', 'local-laundry-service'),
  (3, 2, 7500, 'Smart LED TV 32 inch', 'tv'),
  (4, 2, 7500, 'Smart Phone', 'smartphone'),
  (5, 3, 6500, 'Air Cooler', 'ac-unit'),
  (6, 3, 6500, 'Single Door Refrigerator', 'kitchen'),
  (7, 4, 5000, 'Microwave Oven', 'microwave'),
  (8, 4, 5000, 'Single Tub Washing Machine', 'local-laundry-service'),
  (9, 5, 4000, 'Car Pressure Washer', 'local-car-wash'),
  (10, 5, 4000, 'Air Fryer', 'outdoor-grill'),
  (11, 6, 3000, 'Food Factory', 'blender'),
  (12, 6, 3000, 'Hot Plate', 'soup-kitchen'),
  (13, 7, 2200, 'Juicer Blender', 'blender'),
  (14, 7, 2200, 'Inverter Fan', 'wind-power'),
  (15, 8, 1700, 'Sandwich Maker', 'bakery-dining'),
  (16, 8, 1700, 'Iron', 'iron'),
  (17, 9, 1200, 'Smart Watch', 'watch'),
  (18, 9, 1200, 'Earbuds', 'headphones')
on conflict (id) do update
  set tier = excluded.tier, points = excluded.points, title = excluded.title, icon = excluded.icon;

-- A redemption can be for a gift instead of cash.
alter table public.redemptions add column if not exists reward_id int references public.rewards (id);
alter table public.redemptions add column if not exists reward_title text;

-- Balance: scans + delivered order points + points received for paid requests - own requests.
drop function if exists public.points_balance(text);
create function public.points_balance(p_phone text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(points) from scans where phone = p_phone), 0)
       + coalesce((select sum(points) from orders where placed_by = p_phone and status = 'delivered'), 0)
       + coalesce((select sum(points) from redemptions where to_phone = p_phone and status = 'paid'), 0)
       - coalesce((select sum(points) from redemptions where from_phone = p_phone and status <> 'rejected'), 0)
$$;
revoke execute on function public.points_balance(text) from public, anon, authenticated;

-- Only mechanics scan for points; retailers only check authenticity.
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
  if me is null or public.my_role() is distinct from 'mechanic' then
    raise exception 'Only mechanics can scan for points';
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

-- Retailer orders record the points they will earn on delivery.
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
  insert into orders (placed_by, placed_by_role, retailer, rm, distributor, items, points)
  values (me.phone, me.role, case when me.role = 'mechanic' then me.retailer_phone end,
          me.rm_phone, me.distributor_phone,
          (select jsonb_agg(jsonb_build_object('sku', i->>'sku', 'quantity', (i->>'quantity')::int))
             from jsonb_array_elements(p_items) i),
          case when me.role = 'retailer' then
            (select coalesce(sum(p.order_points * (i->>'quantity')::int), 0)
               from jsonb_array_elements(p_items) i join products p on p.sku = i->>'sku')
          else 0 end)
  returning * into row;
  return row;
end $$;

-- Cash redemptions: mechanics with their retailer or distributor, distributors with the RM.
-- Retailers redeem gifts instead (request_reward).
create or replace function public.request_redemption(p_routed_to text, p_points int) returns public.redemptions
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  recipient text;
  available numeric;
  row public.redemptions;
begin
  select * into me from profiles where phone = public.my_phone();
  if me.role = 'retailer' then raise exception 'Retailers redeem their points for rewards'; end if;
  recipient := case
    when p_routed_to = 'retailer' and me.role = 'mechanic' then me.retailer_phone
    when p_routed_to = 'distributor' and me.role = 'mechanic' then me.distributor_phone
    when p_routed_to = 'rm' and me.role = 'distributor' then me.rm_phone
  end;
  if recipient is null then raise exception 'No one is assigned to receive your request'; end if;
  available := public.points_balance(me.phone);
  if p_points is null or p_points < 1 then raise exception 'Enter the number of points to redeem'; end if;
  if p_points > available then raise exception 'You can redeem up to % pts', greatest(floor(available), 0); end if;
  insert into redemptions (from_phone, to_phone, routed_to, points)
  values (me.phone, recipient, p_routed_to, p_points) returning * into row;
  return row;
end $$;

-- A retailer asks their distributor or RM for a gift from the rewards list.
create or replace function public.request_reward(p_routed_to text, p_reward_id int) returns public.redemptions
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  rw public.rewards;
  recipient text;
  available numeric;
  row public.redemptions;
begin
  select * into me from profiles where phone = public.my_phone();
  if me.role is distinct from 'retailer' then raise exception 'Only retailers can redeem rewards'; end if;
  select * into rw from rewards where id = p_reward_id and active;
  if not found then raise exception 'This reward is not available'; end if;
  recipient := case p_routed_to when 'distributor' then me.distributor_phone when 'rm' then me.rm_phone end;
  if recipient is null then raise exception 'No one is assigned to receive your request'; end if;
  available := public.points_balance(me.phone);
  if rw.points > available then
    raise exception 'You need % more pts for this reward', ceil(rw.points - available);
  end if;
  insert into redemptions (from_phone, to_phone, routed_to, points, reward_id, reward_title)
  values (me.phone, recipient, p_routed_to, rw.points, rw.id, rw.title) returning * into row;
  return row;
end $$;
revoke execute on function public.request_reward(text, int) from public, anon;
grant execute on function public.request_reward(text, int) to authenticated;

-- The recipient pays (cash, amount in PKR) or gives the gift, or rejects the request.
create or replace function public.decide_redemption(p_id text, p_action text, p_amount int default null)
returns public.redemptions
language plpgsql security definer set search_path = public as $$
declare r public.redemptions;
begin
  select * into r from redemptions where id = p_id for update;
  if not found or r.to_phone <> public.my_phone() then raise exception 'This request was not sent to you'; end if;
  if r.status <> 'pending' then raise exception 'This request has already been handled'; end if;
  if p_action = 'pay' then
    if r.reward_id is null and (p_amount is null or p_amount <= 0) then raise exception 'Enter the amount paid'; end if;
    update redemptions
      set status = 'paid', amount = case when r.reward_id is null then p_amount end, decided_at = now()
    where id = p_id returning * into r;
  elsif p_action = 'reject' then
    update redemptions set status = 'rejected', decided_at = now() where id = p_id returning * into r;
  else
    raise exception 'Unknown action';
  end if;
  return r;
end $$;
