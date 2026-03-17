-- Add status column to sale_items table for KDS tracking
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending';

-- Update existing items to 'Pending' if they don't have a status
UPDATE public.sale_items SET status = 'Pending' WHERE status IS NULL;
