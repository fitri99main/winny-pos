CREATE OR REPLACE FUNCTION public.get_occupied_tables()
RETURNS TABLE(table_no text) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin)
AS $$
BEGIN
  RETURN QUERY
  SELECT s.table_no
  FROM public.sales s
  WHERE s.status IN ('Unpaid', 'Pending')
  AND s.table_no IS NOT NULL;
END;
$$;

-- Grant execution to everyone (including anon for Kiosk)
GRANT EXECUTE ON FUNCTION public.get_occupied_tables() TO postgres, anon, authenticated, service_role;
