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
