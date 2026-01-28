-- COMPREHENSIVE FIX FOR PRODUCTS TABLE

-- 1. Ensure Columns Exist and are Nullable (to prevent strictness errors)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- Remove Not Null constraints (except ID) to be safe during dev
ALTER TABLE public.products ALTER COLUMN code DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN name DROP NOT NULL;

-- 2. Fix Sequence (Prevent "Duplicate Key" errors)
-- Reset the ID sequence to the max ID found in the table + 1
SELECT setval(pg_get_serial_sequence('public.products', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM public.products;

-- 3. Fix RLS Policies (Nuclear Option for Dev)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.products;
CREATE POLICY "Enable all access" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- 4. Fix Linked Tables
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.product_recipes;
CREATE POLICY "Enable all access" ON public.product_recipes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.product_addons;
CREATE POLICY "Enable all access" ON public.product_addons FOR ALL USING (true) WITH CHECK (true);

-- 5. Grant Permissions
GRANT ALL ON public.products TO anon, authenticated, service_role;
GRANT ALL ON public.product_recipes TO anon, authenticated, service_role;
GRANT ALL ON public.product_addons TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
