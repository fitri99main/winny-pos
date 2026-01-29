-- Allow Anonymous (Kiosk) to INSERT into sales and sale_items
-- This is required because the Kiosk page is public and does not require login.

-- 1. Policies for SALES table
DROP POLICY IF EXISTS "Enable write access for auth users" ON public.sales;
-- Create a new policy that allows both Authenticated and Anon to insert
CREATE POLICY "Allow authenticated and anon to insert sales" 
ON public.sales FOR INSERT 
WITH CHECK (true);

-- Ensure Update/Delete is still restricted if needed, or leave to existing/default which might be restrictive.
-- Re-create the restricted update/delete policy for auth users only if you want to be safe, 
-- but normally the "Enable write..." covered all. 
-- We split it:
CREATE POLICY "Allow authenticated to update/delete sales" 
ON public.sales FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated to delete sales" 
ON public.sales FOR DELETE
USING (auth.role() = 'authenticated');


-- 2. Policies for SALE_ITEMS table
DROP POLICY IF EXISTS "Enable write access for auth users" ON public.sale_items;

CREATE POLICY "Allow authenticated and anon to insert sale_items" 
ON public.sale_items FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow authenticated to update/delete sale_items" 
ON public.sale_items FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated to delete sale_items" 
ON public.sale_items FOR DELETE
USING (auth.role() = 'authenticated');

-- 3. Grant Permissions
-- Ensure anon role has permission to insert (Supabase defaults might vary)
GRANT INSERT ON public.sales TO anon;
GRANT INSERT ON public.sale_items TO anon;

-- 4. Enable Realtime for Sales (Verify)
-- NOTE: If "supabase_realtime" is already FOR ALL TABLES, these lines will fail.
-- We comment them out as they are likely redundant if Realtime is globally enabled.
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
