
-- Add missing shift management settings to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS require_starting_cash BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_blind_close BOOLEAN DEFAULT false;

-- Update existing row to ensure defaults
UPDATE public.store_settings 
SET 
  require_starting_cash = COALESCE(require_starting_cash, true),
  require_blind_close = COALESCE(require_blind_close, false)
WHERE id = 1;

-- Add comments
COMMENT ON COLUMN public.store_settings.require_starting_cash IS 'Wajibkan kasir memasukkan modal awal saat buka shift';
COMMENT ON COLUMN public.store_settings.require_blind_close IS 'Kasir harus hitung manual tanpa melihat total sistem saat tutup shift';
