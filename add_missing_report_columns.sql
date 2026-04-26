-- SCRIPTS UNTUK MENAMBAHKAN KOLOM PENGATURAN LAPORAN & IZIN KASIR YANG HILANG
-- Jalankan script ini di Supabase SQL Editor

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS show_tax_on_report BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_discount_on_report BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_qris_on_report BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_category_on_summary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS wifi_voucher_min_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wifi_voucher_multiplier NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashier_can_view_reports BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cashier_can_view_session_history BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cashier_can_print_financial_receipt BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cashier_can_print_sales_summary BOOLEAN DEFAULT false;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
