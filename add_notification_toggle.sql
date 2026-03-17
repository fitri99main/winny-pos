
-- ADD disable_web_kiosk_notifications column if missing
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS disable_web_kiosk_notifications BOOLEAN DEFAULT false;

-- Notify
SELECT 'Added disable_web_kiosk_notifications column to store_settings' as status;
