-- Add receipt_footer_feed column to store_settings table
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS receipt_footer_feed INTEGER DEFAULT 4;

-- Update existing row
UPDATE public.store_settings 
SET receipt_footer_feed = 4
WHERE id = 1;
