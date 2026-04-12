-- SYNC: Ensure all Auth users have a Profile
-- This script finds users in auth.users that are missing in public.profiles
-- and creates their profile with default values.

INSERT INTO public.profiles (id, email, name, role, branch_id, status)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', 'User'), 
  COALESCE(raw_user_meta_data->>'role', 'Kasir'),
  COALESCE(raw_user_meta_data->>'branch_id', '7'),
  'Aktif'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Also ensure any existing profiles with NULL email/name/role are filled
UPDATE public.profiles p
SET 
  email = COALESCE(p.email, u.email),
  name = COALESCE(p.name, u.raw_user_meta_data->>'name', 'User'),
  role = COALESCE(p.role, u.raw_user_meta_data->>'role', 'Kasir'),
  branch_id = COALESCE(p.branch_id, u.raw_user_meta_data->>'branch_id', '7'),
  status = COALESCE(p.status, 'Aktif')
FROM auth.users u
WHERE p.id = u.id 
  AND (p.email IS NULL OR p.name IS NULL OR p.role IS NULL OR p.branch_id IS NULL);
