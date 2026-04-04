-- Add notes column to sale_items table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS notes text;
