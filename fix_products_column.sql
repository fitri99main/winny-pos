-- Fix missing code column in products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code text;

-- Also ensure RLS policies are correct just in case
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'products' AND policyname = 'Enable all access') THEN
        CREATE POLICY "Enable all access" ON public.products FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
