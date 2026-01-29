-- Add customer_name column to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS customer_name text;

-- Optional: Update RLS policies if needed, but existing ones usually cover new columns if they are row-based.
-- Just to be safe, granting access is usually done via existing roles.
