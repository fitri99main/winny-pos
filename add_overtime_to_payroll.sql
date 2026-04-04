-- Migration: Add Overtime (Lembur) field to Payrolls table
-- Run this in Supabase SQL Editor

ALTER TABLE public.payrolls 
ADD COLUMN IF NOT EXISTS overtime NUMERIC DEFAULT 0;

-- Optional: Comment
COMMENT ON COLUMN public.payrolls.overtime IS 'Nilai lembur (Overtime) karyawan untuk periode tersebut';
