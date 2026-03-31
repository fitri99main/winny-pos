-- Add wifi_voucher_multiplier to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS wifi_voucher_multiplier NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.store_settings.wifi_voucher_multiplier IS 'Kelipatan belanja untuk mendapatkan 1 voucher WiFi (0 = hanya 1 voucher per transaksi jika memenuhi minimal belanja)';
