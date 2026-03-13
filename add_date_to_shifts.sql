-- Add date column to shifts table
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS date DATE;
