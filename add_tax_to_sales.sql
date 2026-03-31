-- Migration to add tax column to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN public.sales.tax IS 'Nilai pajak dari transaksi penjualan';
