-- Add sort_order column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialize sort_order based on existing IDs to maintain current order
UPDATE public.products SET sort_order = id WHERE sort_order = 0;

-- Create an index to improve ordering performance
CREATE INDEX IF NOT EXISTS products_sort_order_idx ON public.products (sort_order);
