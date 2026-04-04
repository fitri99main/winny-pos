-- Add kiosk_display_mode to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS kiosk_display_mode BOOLEAN DEFAULT false;

-- Also add a column for custom kiosk message (Optional but nice for "Scan to Order")
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS kiosk_display_message TEXT DEFAULT 'Scan QR untuk pesan melalui HP Anda';
