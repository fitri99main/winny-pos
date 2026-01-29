-- Add receipt toggles for customer info
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS show_customer_name BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_customer_status BOOLEAN DEFAULT true;
