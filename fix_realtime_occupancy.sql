-- Re-create the function to be absolutely sure it exists and has SECURITY DEFINER
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

-- Grant execution to access roles
GRANT EXECUTE ON FUNCTION public.get_occupied_tables() TO postgres, anon, authenticated, service_role;

-- IMPORTANT: FORCE Refresh the schema cache if possible (by simple comment on schema)
COMMENT ON FUNCTION public.get_occupied_tables() IS 'Returns list of occupied tables based on active sales';

-- Ensure anon can SELECT from tables (already likely generic read, but just in case)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tables;
CREATE POLICY "Enable read access for all users" ON public.tables FOR SELECT USING (true);
GRANT SELECT ON public.tables TO anon;

-- Ensure Kiosk can access the newly created sales (Wait, we did this in fix_kiosk_access.sql)
-- But let's double check that 'sales' is readable by anon if they need to fetch it (though RPC handles it)
