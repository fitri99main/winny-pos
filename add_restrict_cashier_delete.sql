-- Menambahkan kolom pembatasan hapus transaksi untuk kasir
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS restrict_cashier_delete BOOLEAN DEFAULT false;

-- Update existing records to false
UPDATE store_settings SET restrict_cashier_delete = false WHERE restrict_cashier_delete IS NULL;
