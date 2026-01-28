-- Fix Products Table Sequence
-- Run this in Supabase SQL Editor to fix "duplicate key value violates unique constraint" errors

-- 1. Reset sequence for products table
SELECT setval(pg_get_serial_sequence('public.products', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.products;

-- 2. Reset sequence for ingredients table (just in case)
SELECT setval(pg_get_serial_sequence('public.ingredients', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.ingredients;

-- 3. Reset sequence for categories, units, brands
SELECT setval(pg_get_serial_sequence('public.categories', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.categories;
SELECT setval(pg_get_serial_sequence('public.units', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.units;
SELECT setval(pg_get_serial_sequence('public.brands', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.brands;

-- 4. Ensure RLS allows insert for authenticated users (Redundant if fix_product_schema_v2.sql ran, but harmless)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'products' AND policyname = 'Enable all access') THEN
        CREATE POLICY "Enable all access" ON public.products FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
