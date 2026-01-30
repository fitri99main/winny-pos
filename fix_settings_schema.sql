-- Add tax_rate and service_rate columns to store_settings table
ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_rate numeric(5, 2) DEFAULT 0;

-- Also verify sales table has tax columns (just in case)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS tax numeric(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_charge numeric(15, 2) DEFAULT 0;

-- Notify that schema is updated
SELECT 'Schema updated successfully' as status;
