-- Add restriction columns to store_settings
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS restrict_discount BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS restrict_hold_order BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS restrict_cashier_delete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS restrict_manual_item BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS restrict_split_bill BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS restrict_cashier_discount BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS restrict_cashier_hold BOOLEAN DEFAULT FALSE;

-- Update existing row to have false as default
UPDATE store_settings SET 
  restrict_discount = COALESCE(restrict_discount, FALSE),
  restrict_hold_order = COALESCE(restrict_hold_order, FALSE),
  restrict_cashier_delete = COALESCE(restrict_cashier_delete, FALSE),
  restrict_manual_item = COALESCE(restrict_manual_item, FALSE),
  restrict_split_bill = COALESCE(restrict_split_bill, FALSE),
  restrict_cashier_discount = COALESCE(restrict_cashier_discount, FALSE),
  restrict_cashier_hold = COALESCE(restrict_cashier_hold, FALSE)
WHERE id = 1;
