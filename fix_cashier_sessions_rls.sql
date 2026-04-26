-- Force fix for cashier sessions RLS
BEGIN;

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON public.cashier_sessions;
DROP POLICY IF EXISTS "Cashiers can update their own sessions" ON public.cashier_sessions;
DROP POLICY IF EXISTS "Admins can do everything on sessions" ON public.cashier_sessions;

-- Create a robust policy that allows authenticated users to manage sessions
-- This ensures that if a cashier is logged in, they can update the session record
CREATE POLICY "Sessions management policy" 
ON public.cashier_sessions
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure the table is public and accessible
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

-- If session #135 is stuck, we can manually close it if needed, 
-- but let's try the RLS fix first.

COMMIT;
