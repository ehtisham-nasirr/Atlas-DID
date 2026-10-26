-- Orders: the distributor sees an order only after the RM approves it, and retailers earn their
-- order points as soon as the RM approves (not on delivery). Run once in the SQL editor.

drop policy if exists "orders of my network" on public.orders;
create policy "orders of my network" on public.orders for select to authenticated
  using (
    (select public.my_phone()) in (placed_by, retailer, rm)
    or ((select public.my_phone()) = distributor and status in ('approved', 'dispatched', 'delivered'))
  );

-- Balance: scans + approved order points + points received for paid requests - own requests.
create or replace function public.points_balance(p_phone text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(points) from scans where phone = p_phone), 0)
       + coalesce((select sum(points) from orders
                    where placed_by = p_phone and status in ('approved', 'dispatched', 'delivered')), 0)
       + coalesce((select sum(points) from redemptions where to_phone = p_phone and status = 'paid'), 0)
       - coalesce((select sum(points) from redemptions where from_phone = p_phone and status <> 'rejected'), 0)
$$;
revoke execute on function public.points_balance(text) from public, anon, authenticated;
