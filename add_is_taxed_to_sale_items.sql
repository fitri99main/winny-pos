-- Add is_taxed column to sale_items table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS is_taxed BOOLEAN DEFAULT FALSE;

-- Update existing items from products table if possible
UPDATE public.sale_items si
SET is_taxed = p.is_taxed
FROM public.products p
WHERE si.product_id = p.id;
