alter table public.promos add column if not exists audience text[] not null
  default '{mechanic,retailer,distributor}';
alter table public.promos drop constraint if exists promos_audience_check;
alter table public.promos add constraint promos_audience_check
  check (cardinality(audience) > 0 and audience <@ array['mechanic', 'retailer', 'distributor']);
drop policy if exists "members read promos" on public.promos;
create policy "members read promos" on public.promos for select to authenticated
  using ((select public.my_role()) = 'rm' or (select public.my_role()) = any (audience));
