-- Add enable_auto_cut column to store_settings
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS enable_auto_cut BOOLEAN DEFAULT TRUE;

-- Update existing row
UPDATE store_settings SET 
  enable_auto_cut = COALESCE(enable_auto_cut, TRUE)
WHERE id = 1;
