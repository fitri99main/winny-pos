-- Migration: Add sales_view_percentage to store_settings
-- Column to define what percentage of sales transactions a restricted user can view.
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS sales_view_percentage INTEGER DEFAULT 70;

COMMENT ON COLUMN public.store_settings.sales_view_percentage IS 'Persentase transaksi penjualan yang dapat dilihat oleh wewenang yang dibatasi (default 70)';
