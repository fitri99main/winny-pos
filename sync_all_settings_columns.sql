-- CUMULATIVE SQL PATCH: SINKRONISASI SCHEMA PENGATURAN
-- Perintah ini akan menambahkan semua kolom yang diperlukan oleh aplikasi ke tabel store_settings.
-- Jalankan ini di SQL Editor Supabase untuk mengatasi Error 400 saat simpan pengaturan.

ALTER TABLE public.store_settings 
-- Pengaturan Umum & Absensi
ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]'::jsonb,
ADD COLUMN IF NOT EXISTS enable_manager_auth BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_fingerprint BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hide_camera_scanner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_attendance_fab BOOLEAN DEFAULT true,

-- Pengaturan Kasir & Sesi
ADD COLUMN IF NOT EXISTS require_mandatory_session BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_starting_cash BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_blind_close BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_open_drawer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS print_kds_on_hold BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_table_management BOOLEAN DEFAULT true,

-- Penomoran Invoice (Auto/Manual) dan Offline
ADD COLUMN IF NOT EXISTS invoice_mode TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS invoice_last_number BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS offline_invoice_mode TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS offline_invoice_prefix TEXT DEFAULT 'OFF',
ADD COLUMN IF NOT EXISTS offline_invoice_last_number BIGINT DEFAULT 0,

-- Tampilan & Media
ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light',
ADD COLUMN IF NOT EXISTS quick_cash_amounts JSONB DEFAULT '[10000, 20000, 50000, 100000]'::jsonb,
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receipt_logo_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS receipt_footer_feed INTEGER DEFAULT 4,

-- Printer Tiket Langsung
ADD COLUMN IF NOT EXISTS auto_print_kitchen BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_print_bar BOOLEAN DEFAULT false;

-- Berikan komentar pada kolom baru untuk dokumentasi
COMMENT ON COLUMN public.store_settings.show_attendance_fab IS 'Tampilkan tombol melayang absensi di dashboard';
COMMENT ON COLUMN public.store_settings.invoice_mode IS 'Mode penomoran invoice (auto/manual)';
COMMENT ON COLUMN public.store_settings.working_days IS 'Daftar hari operasional toko';
