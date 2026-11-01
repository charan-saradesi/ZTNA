-- Run in Supabase -> SQL Editor (Role: postgres)
-- Links each organization row to its login (Supabase Auth user)
alter table public.organizations
  add column if not exists auth_user_id uuid;
