-- Add paid_amount and change columns to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "change" numeric DEFAULT 0;
