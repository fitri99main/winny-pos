-- Migration to add offline invoice numbering settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS offline_invoice_mode TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS offline_invoice_prefix TEXT DEFAULT 'OFF',
ADD COLUMN IF NOT EXISTS offline_invoice_last_number BIGINT DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN public.store_settings.offline_invoice_mode IS 'Mode penomoran invoice offline: auto atau manual';
COMMENT ON COLUMN public.store_settings.offline_invoice_prefix IS 'Prefix untuk penomoran invoice otomatis saat offline';
COMMENT ON COLUMN public.store_settings.offline_invoice_last_number IS 'Nomor urut terakhir untuk penomoran invoice otomatis saat offline';
