-- 1. ADD MISSING COLUMNS (Safe to run even if columns exist)
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists role text default 'Kasir';
alter table public.profiles add column if not exists branch_id text;
alter table public.profiles add column if not exists status text default 'Aktif';

-- 2. RESET POLICIES (Just in case)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

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

-- 3. FILL THE DATA
insert into public.profiles (id, email, name, role, status)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'name', 'Admin User'), 
  'Administrator', 
  'Aktif'
from auth.users
where id not in (select id from public.profiles);
