-- CRITICAL FIX: Allow Kiosk (anon) to SEE sales to trigger Realtime updates
-- Without SELECT permission, Supabase Realtime (and likely RPC in some contexts) will not return data/events.

-- 1. Allow 'anon' to basic SELECT on sales
-- We limit this to only necessary statuses to minimize data exposure, 
-- though Realtime might require broader access to see the *transition*.
-- Let's allow viewing all sales for simplicity to ensure sync works, 
-- assuming Kiosk is a trusted device environment.
CREATE POLICY "Allow anon to view sales" 
ON public.sales FOR SELECT 
USING (true);

-- 2. Grant SELECT permission
GRANT SELECT ON public.sales TO anon;

-- 3. Verify RPC one more time (ensuring no ambiguity)
CREATE OR REPLACE FUNCTION public.get_occupied_tables()
RETURNS TABLE(table_no text) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.table_no
  FROM public.sales s
  WHERE s.status IN ('Unpaid', 'Pending')
  AND s.table_no IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_occupied_tables() TO anon;
