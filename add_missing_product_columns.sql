-- Add missing columns to products table if they don't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_taxed BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_stock_ready BOOLEAN DEFAULT true;

-- Ensure target column exists (added in a previous migration but just in case)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS target TEXT DEFAULT 'Kitchen';

-- Update RLS if needed (though it should be already enabled with "Enable all access")
-- ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
