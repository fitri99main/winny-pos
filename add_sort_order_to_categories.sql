-- Add sort_order column to categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialize sort_order based on existing IDs to maintain current order
UPDATE public.categories SET sort_order = id WHERE sort_order = 0;

-- Create an index to improve ordering performance
CREATE INDEX IF NOT EXISTS categories_sort_order_idx ON public.categories (sort_order);
