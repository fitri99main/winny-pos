-- Add require_mandatory_session setting to store_settings table
-- This setting controls whether users must open/close cash register sessions

ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS require_mandatory_session BOOLEAN DEFAULT true;

-- Update existing row to enable mandatory session by default
UPDATE store_settings 
SET require_mandatory_session = true 
WHERE id = 1;

-- Add comment for documentation
COMMENT ON COLUMN store_settings.require_mandatory_session IS 'Wajibkan user untuk membuka shift kasir sebelum menggunakan aplikasi dan menutup shift sebelum logout';
