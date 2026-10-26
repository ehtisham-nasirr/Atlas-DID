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

grant execute on function public.credit_scan(text) to authenticated;
grant execute on function public.create_user(text, text, text, text, text, text, text, text, text) to authenticated;
