-- Add tax and service columns to sales table
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS tax numeric(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_charge numeric(15, 2) DEFAULT 0;

-- Update store_settings to include tax and service rates if not JSON
-- Assuming store_settings is a table with flexible columns or JSON
-- If store_settings is key-value, no need. If it has explicit columns, we might need to add them.
-- Based on the code `storeSettings` seems to be a single object, likely from a table where columns are explicit or jsonb.
-- Let's assume we need to add columns to store_settings if it's not JSONB.
ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_rate numeric(5, 2) DEFAULT 0;
