-- Run this in Supabase -> SQL Editor (set the Role dropdown to "postgres" if you get a permission error)

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  display_name  text,
  website_url   text,
  created_at    timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Only logged-in users whose app_metadata.role = 'admin' can read or change organizations
drop policy if exists "admins manage organizations" on public.organizations;
create policy "admins manage organizations"
  on public.organizations
  for all
  to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Optional: first row, like the built-in organization
insert into public.organizations (name, display_name, website_url)
values ('built-in', 'Built-in Organization', 'https://example.com')
on conflict (name) do nothing;
