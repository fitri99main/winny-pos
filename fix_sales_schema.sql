-- Add table_no column to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS table_no TEXT;

-- Update existing sales to have '-' as table_no if null (Optional)
UPDATE public.sales SET table_no = '-' WHERE table_no IS NULL;
