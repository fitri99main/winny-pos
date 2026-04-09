-- Add print_kds_on_hold to store_settings table
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS print_kds_on_hold BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.store_settings.print_kds_on_hold IS 'Cetak tiket Dapur & Bar secara otomatis saat transaksi di Hold';
