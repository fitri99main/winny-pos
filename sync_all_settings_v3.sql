-- Master SQL Fix for Store Settings (PGRST204)
-- Run this in your Supabase SQL Editor to add all necessary missing columns.

ALTER TABLE public.store_settings 
-- 1. General & Operational Settings
ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]'::jsonb,
ADD COLUMN IF NOT EXISTS require_mandatory_session BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS preparation_duration_minutes INTEGER DEFAULT 15,

-- 2. Reporting Permissions & Toggles
ADD COLUMN IF NOT EXISTS cashier_can_view_reports BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cashier_can_print_financial_receipt BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cashier_can_print_sales_summary BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_tax_on_report BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_discount_on_report BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_qris_on_report BOOLEAN DEFAULT true,

-- 3. WiFi Voucher Settings
ADD COLUMN IF NOT EXISTS enable_wifi_vouchers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wifi_voucher_min_amount BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS wifi_voucher_multiplier BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS wifi_voucher_notice TEXT DEFAULT 'Gunakan kode ini untuk akses WiFi',

-- 4. Financial & Tax Settings
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_rate NUMERIC(10,2) DEFAULT 0,

-- 5. Receipt Customization (Header/Footer/Toggles)
ADD COLUMN IF NOT EXISTS receipt_header TEXT DEFAULT 'WINNY POS',
ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Terima Kasih',
ADD COLUMN IF NOT EXISTS receipt_footer_feed INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_date BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_cashier_name BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_waiter BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_table BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_customer_name BOOLEAN DEFAULT true,

-- 6. Invoice Numbering (Auto/Manual and Offline)
ADD COLUMN IF NOT EXISTS invoice_mode TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS invoice_last_number BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS offline_invoice_mode TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS offline_invoice_prefix TEXT DEFAULT 'OFF',
ADD COLUMN IF NOT EXISTS offline_invoice_last_number BIGINT DEFAULT 0;

-- 7. Ensure ID 1 exists (Primary row for global settings)
INSERT INTO public.store_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 8. Log success
SELECT 'Settings schema synchronized successfully. All missing columns added.' as result;
