-- FINAL REPAIR SCRIPT
-- This script resets ALL permissions to be safe and clear.

-- 1. DELETE ALL OLD POLICIES (Clean Slate)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Authenticated can insert profiles" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Admins can delete any profile" on public.profiles;
drop policy if exists "Read access" on public.profiles;
drop policy if exists "Insert access" on public.profiles;
drop policy if exists "Update access" on public.profiles;
drop policy if exists "Delete access" on public.profiles;

-- 2. ENSURE RLS ENABLED
alter table public.profiles enable row level security;

-- 3. CREATE NEW POLICIES (Simple & Robust)
-- READ: Everyone logs in can see everyone (Required for User Management)
create policy "Read access" on public.profiles for select using ( auth.role() = 'authenticated' );

-- INSERT: Everyone logs in can create users (Required for 'Add User' button)
create policy "Insert access" on public.profiles for insert with check ( auth.role() = 'authenticated' );

-- UPDATE: You can edit yourself OR Admin can edit you
create policy "Update access" on public.profiles for update using ( 
  auth.uid() = id OR 
  (select role from public.profiles where id = auth.uid()) = 'Administrator'
);

-- DELETE: Only Admin
create policy "Delete access" on public.profiles for delete using ( 
  (select role from public.profiles where id = auth.uid()) = 'Administrator'
);

-- 4. FIX MISSING DATA (Backfill)
-- If User exists in Authentication but not in Profiles table, create them now.
insert into public.profiles (id, email, name, role, status)
select 
  id, 
  email, 
  'User ' || substr(email, 1, 5), -- Default Name if missing
  'Kasir',                        -- Default Role
  'Aktif'
from auth.users
where id not in (select id from public.profiles);
