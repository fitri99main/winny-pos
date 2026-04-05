-- 0. Enable pgcrypto (important for crypt function)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to reset password by Admin
-- This function runs with security definer (bypass RLS)
-- and can only be called if the authenticated user has the 'Administrator' role.

CREATE OR REPLACE FUNCTION admin_reset_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- 1. Get the role of the caller from profiles table
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

    -- 2. Verify caller is an Administrator
    IF caller_role != 'Administrator' THEN
        RAISE EXCEPTION 'Access Denied: Only Administrators can reset passwords.';
    END IF;

    -- 3. Update the password in auth.users
    -- Note: This requires pgcrypto extension installed
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
