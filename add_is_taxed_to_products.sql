-- Add is_taxed column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_taxed boolean DEFAULT true;

-- Update existing products to have is_taxed = true
UPDATE public.products SET is_taxed = true WHERE is_taxed IS NULL;
