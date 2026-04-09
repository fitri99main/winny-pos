-- Add items_list column to store purchase items as JSON
-- Run this in Supabase SQL Editor
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS items_list JSONB;

COMMENT ON COLUMN public.purchases.items_list IS 'Daftar item barang yang dibeli dalam transaksi ini melauli Mobile/Web';
