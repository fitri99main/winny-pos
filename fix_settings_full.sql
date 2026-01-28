-- FINAL FIX SCRIPT (REVISI LENGKAP) --
-- Script ini menjamin SEMUA kolom yang dibutuhkan aplikasi tersedia di tabel.

-- 1. Tambahkan Semua Kolom yang Hilang
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT 'Jl. Contoh No. 123',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '+6281234567890',
ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Terima Kasih',
ADD COLUMN IF NOT EXISTS receipt_paper_width TEXT DEFAULT '58mm',
ADD COLUMN IF NOT EXISTS show_date BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_waiter BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_table BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS working_days TEXT[] DEFAULT ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
ADD COLUMN IF NOT EXISTS late_tolerance INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS enable_email_notif BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_push_notif BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS low_stock_alert BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light';

-- 2. Update Data Default (Hanya jika masih kosong/NULL)
UPDATE public.store_settings 
SET 
  address = COALESCE(address, 'Jl. Contoh No. 123'),
  phone = COALESCE(phone, '+6281234567890'),
  receipt_paper_width = COALESCE(receipt_paper_width, '58mm')
WHERE id = 1;
