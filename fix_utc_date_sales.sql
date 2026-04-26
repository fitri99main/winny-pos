-- ================================================================
-- FIX: Update tanggal transaksi dari UTC ke WIB (UTC+7)
-- Tujuan: Transaksi yang dibuat sebelum jam 07:00 WIB tersimpan
--         sebagai tanggal kemarin (UTC). Script ini mengonversi
--         kolom 'date' dari UTC ke timezone Asia/Jakarta (WIB).
-- ================================================================

-- PREVIEW DULU (tidak mengubah data):
-- Lihat transaksi yang masih tersimpan UTC (tanggal berbeda jika dikonversi ke WIB)
SELECT 
    id,
    order_no,
    date AS date_utc,
    (date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') AS date_wib,
    date(date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') AS tanggal_wib
FROM sales
WHERE date::text LIKE '%Z' OR date::text LIKE '%+00:00'
ORDER BY date DESC
LIMIT 50;

-- ================================================================
-- JALANKAN UPDATE (Konversi kolom date ke timezone WIB):
-- Ini menyimpan timestamp dengan offset WIB (+07) agar filter
-- tanggal di web dashboard otomatis menampilkan tanggal yang benar.
-- ================================================================
-- UPDATE sales
-- SET date = (date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')
-- WHERE date IS NOT NULL;

-- ================================================================
-- ALTERNATIF LEBIH AMAN (hanya update data hari ini yang salah):
-- Ubah baris di bawah ini dengan tanggal yang ingin dikoreksi:
-- ================================================================
UPDATE sales
SET date = (date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')
WHERE date::date = '2026-04-18'  -- Data yang tersimpan sebagai tgl 18 UTC
  AND (date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = '2026-04-19'; 
  -- Tapi sebenarnya tgl 19 WIB
