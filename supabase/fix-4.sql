create table if not exists public.promos (
  id bigint generated always as identity primary key,
  image_url text not null,
  title text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.promos enable row level security;
drop policy if exists "members read promos" on public.promos;
drop policy if exists "rm adds promos" on public.promos;
drop policy if exists "rm edits promos" on public.promos;
drop policy if exists "rm deletes promos" on public.promos;
create policy "members read promos" on public.promos for select to authenticated
  using ((select public.my_phone()) is not null);
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
