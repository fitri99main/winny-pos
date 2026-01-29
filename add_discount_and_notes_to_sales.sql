-- Add discount and notes columns to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS notes text;
