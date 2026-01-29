-- Allow Anonymous (Kiosk) to view branches
-- This is required because the Kiosk needs to fetch the branch_id to associate sales with a branch.

-- 1. Enable RLS on branches if not already enabled
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;

-- 2. Create policy to allow anyone (including anon) to view branches
DROP POLICY IF EXISTS "Allow anon to view branches" ON public.branches;
CREATE POLICY "Allow anon to view branches" 
ON public.branches FOR SELECT 
USING (true);

-- 3. Grant SELECT permission to anon role
GRANT SELECT ON public.branches TO anon;
