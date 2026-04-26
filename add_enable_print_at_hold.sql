-- ================================================================
-- FIX: Tambah kolom 'enable_print_at_hold' ke store_settings
-- Error: "Could not find the 'enable_print_at_hold' column of
--         'store_settings' in the schema cache"
-- ================================================================

ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS enable_print_at_hold BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.store_settings.enable_print_at_hold
IS 'Cetak tiket Dapur & Bar secara otomatis saat transaksi di-Hold oleh kasir';

-- Verifikasi kolom berhasil ditambahkan:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'store_settings'
  AND column_name = 'enable_print_at_hold';
