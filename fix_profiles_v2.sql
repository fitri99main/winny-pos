-- 1. DROP EXISTING POLICIES (To fix "Already Exists" error)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- 2. ENSURE TABLE EXISTS
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  role text default 'Kasir',
  branch_id text,
  status text default 'Aktif',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. RE-ENABLE RLS & CREATE POLICIES
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone" 
  on profiles for select 
  using ( true );

create policy "Users can insert their own profile" 
  on profiles for insert 
  with check ( auth.uid() = id );

create policy "Users can update own profile" 
  on profiles for update 
  using ( auth.uid() = id );

-- 4. CRITICAL FIX: Backfill Missing Profiles
-- This inserts a profile for ANY user that registered but doesn't have a profile yet.
insert into public.profiles (id, email, name, role, status)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'name', 'Admin User'), 
  'Administrator', -- Force Admin for existing users to regain access
  'Aktif'
from auth.users
where id not in (select id from public.profiles);
