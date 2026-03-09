-- MASTER FIX FOR STORE_SETTINGS TABLE
-- This script adds all missing columns required by the modern SettingsView UI.

ALTER TABLE public.store_settings 
-- General & Financial
ADD COLUMN IF NOT EXISTS store_name TEXT DEFAULT 'WinPOS Store',
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS force_offline BOOLEAN DEFAULT false,

-- Biometrics & Auth
ADD COLUMN IF NOT EXISTS enable_fingerprint BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hide_camera_scanner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_manager_auth BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enforce_single_device BOOLEAN DEFAULT true,

-- Receipt & Layout
ADD COLUMN IF NOT EXISTS receipt_header TEXT DEFAULT 'WINNY PANGERAN NATAKUSUMA',
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receipt_logo_url TEXT,

-- WiFi Vouchers
ADD COLUMN IF NOT EXISTS enable_wifi_vouchers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wifi_voucher_notice TEXT DEFAULT 'Gunakan kode ini untuk akses WiFi',

-- Operational
ADD COLUMN IF NOT EXISTS require_starting_cash BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_blind_close BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_open_drawer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS require_mandatory_session BOOLEAN DEFAULT true,

-- Quick Cash & Others
ADD COLUMN IF NOT EXISTS quick_cash_amounts JSONB DEFAULT '[10000, 20000, 50000, 100000]'::jsonb,
ADD COLUMN IF NOT EXISTS branch_id UUID; -- If using multi-branch

-- Ensure row 1 exists
INSERT INTO public.store_settings (id, store_name)
VALUES (1, 'WinPOS Store')
ON CONFLICT (id) DO NOTHING;

-- Notify
SELECT 'Store settings schema synchronized successfully' as status;
