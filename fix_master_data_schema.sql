-- FIX MISSING COLUMNS IN MASTER DATA TABLES

-- 1. Categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description text;

-- 2. Brands
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS description text;

-- 3. Units (Ensure abbreviation exists)
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS abbreviation text;

-- 4. Reset sequences just in case
SELECT setval(pg_get_serial_sequence('public.categories', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.categories;
SELECT setval(pg_get_serial_sequence('public.brands', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.brands;
SELECT setval(pg_get_serial_sequence('public.units', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.units;

-- 5. Enable all access (RLS)
DROP POLICY IF EXISTS "Enable all access" ON public.categories;
CREATE POLICY "Enable all access" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON public.brands;
CREATE POLICY "Enable all access" ON public.brands FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON public.units;
CREATE POLICY "Enable all access" ON public.units FOR ALL USING (true) WITH CHECK (true);
