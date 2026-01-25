-- 1. DROP RESTRICTIVE POLICIES
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
-- Keep the SELECT policy as it is permissive enough
-- drop policy "Public profiles are viewable by everyone" ...

-- 2. CREATE POWERFUL ADMIN POLICIES
-- Allow anyone to insert (needed because sometimes the 'insert' happens before the user is fully recognized, or by trigger)
-- But primarily, we want to allow Admin to insert for others.
-- Simplest approach for this app: Allow Authenticated users to INSERT any profile (to support creating users).
create policy "Authenticated can insert profiles" 
  on profiles for insert 
  with check ( auth.role() = 'authenticated' );

-- Allow Admin to UPDATE any profile
create policy "Admins can update any profile" 
  on profiles for update 
  using ( 
    (select role from public.profiles where id = auth.uid()) = 'Administrator' 
    OR 
    auth.uid() = id 
  );

-- Allow Admin to DELETE any profile
create policy "Admins can delete any profile" 
  on profiles for delete 
  using ( 
    (select role from public.profiles where id = auth.uid()) = 'Administrator' 
  );

-- 3. INTELLIGENT BACKFILL (Restores missing Cashiers)
-- Finds users in auth.users who are NOT in profiles, and inserts them.
-- Tries to read the role from metadata, or defaults to 'Kasir'.
insert into public.profiles (id, email, name, role, status)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'name', 'User'), 
  coalesce(raw_user_meta_data->>'role', 'Kasir'), -- Read role from Auth Metadata!
  'Aktif'
from auth.users
where id not in (select id from public.profiles);
