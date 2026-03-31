-- Migration to add invoice numbering settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS invoice_mode TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS invoice_last_number BIGINT DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN public.store_settings.invoice_mode IS 'Mode penomoran invoice: auto atau manual';
COMMENT ON COLUMN public.store_settings.invoice_prefix IS 'Prefix untuk penomoran invoice otomatis';
COMMENT ON COLUMN public.store_settings.invoice_last_number IS 'Nomor urut terakhir untuk penomoran invoice otomatis';
