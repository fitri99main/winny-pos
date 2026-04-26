-- Ensure purchases table has the required columns for stock sync
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS items_list JSONB DEFAULT '[]'::jsonb;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_invoice_no TEXT;
