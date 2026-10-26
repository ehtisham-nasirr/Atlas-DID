alter table public.profiles add column if not exists photo_url text;
grant update (photo_url) on public.profiles to authenticated;
