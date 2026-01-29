-- Add is_sellable column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN DEFAULT true;

-- Update existing products to be sellable by default (if the above didn't handle it for some reason)
UPDATE public.products SET is_sellable = true WHERE is_sellable IS NULL;
