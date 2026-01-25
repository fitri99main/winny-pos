-- 1. DROP RESTRICTIVE CONSTRAINT
-- This constraint restricts what roles can be inserted. 
-- Since we want dynamic roles (Admin, Custom, etc.), we must remove it.
alter table public.profiles drop constraint if exists profiles_role_check;

-- 2. TRY INSERTING AGAIN
insert into public.profiles (id, email, name, role, status)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'name', 'Admin User'), 
  'Administrator', 
  'Aktif'
from auth.users
where id not in (select id from public.profiles);
