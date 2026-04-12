-- FIX: handle_new_user() trigger function
-- This ensures that when a new user is created via Supabase Auth,
-- the branch_id is correctly mapped from metadata and is NEVER NULL.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, branch_id, role, status)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'branch_id', '7'), -- Fallback to '7' (First Branch)
    COALESCE(new.raw_user_meta_data->>'role', 'Kasir'), -- Default to 'Kasir' if not specified
    'Aktif'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RE-LINK TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- CLEANUP: Fix existing users with NULL branch_id
-- We assign them to the default branch '7' if they are missing one.
UPDATE public.profiles 
SET branch_id = '7' 
WHERE branch_id IS NULL OR branch_id = '';

-- Trigger handle_new_user updated and existing NULL branch_ids fixed.
