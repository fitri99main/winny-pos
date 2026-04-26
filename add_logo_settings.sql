-- ENSURE LOGO COLUMNS EXIST --
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receipt_logo_url TEXT;

-- Update existing row if missing defaults
UPDATE public.store_settings 
SET show_logo = COALESCE(show_logo, true)
WHERE id = 1;
