-- Combined Migration: Add sort_order to Products and Categories
-- Run this in your Supabase SQL Editor if you see no changes on Vercel

-- 1. Products Table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
UPDATE public.products SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL;
CREATE INDEX IF NOT EXISTS products_sort_order_idx ON public.products (sort_order);

-- 2. Categories Table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
UPDATE public.categories SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL;
CREATE INDEX IF NOT EXISTS categories_sort_order_idx ON public.categories (sort_order);

-- 3. Payment Methods (Optional but good for consistency)
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
UPDATE public.payment_methods SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL;
