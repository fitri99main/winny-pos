-- ============================================================
-- MIGRASI HPP SNAPSHOT (Metode 1)
-- Tujuan: Memastikan kolom 'cost' ada di tabel sale_items
-- dan mengisi nilai HPP historis dari tabel products
-- ============================================================

-- 1. Tambahkan kolom 'cost' jika belum ada
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;

-- 2. Backfill: Isi HPP dari tabel products untuk transaksi lama yang cost-nya masih 0
--    Hanya update baris yang belum pernah memiliki data HPP (cost = 0 atau NULL)
UPDATE public.sale_items si
SET cost = p.cost
FROM public.products p
WHERE si.product_id = p.id
  AND (si.cost IS NULL OR si.cost = 0)
  AND p.cost IS NOT NULL
  AND p.cost > 0;

-- 3. Fallback: Isi berdasarkan nama produk jika product_id tidak ada
UPDATE public.sale_items si
SET cost = p.cost
FROM public.products p
WHERE si.product_name = p.name
  AND (si.cost IS NULL OR si.cost = 0)
  AND p.cost IS NOT NULL
  AND p.cost > 0;

-- 4. Verifikasi: Hitung berapa baris yang sudah memiliki HPP
SELECT
  COUNT(*) AS total_items,
  COUNT(CASE WHEN cost > 0 THEN 1 END) AS items_with_cost,
  COUNT(CASE WHEN cost = 0 OR cost IS NULL THEN 1 END) AS items_without_cost,
  ROUND(AVG(CASE WHEN cost > 0 THEN cost END), 0) AS avg_hpp
FROM public.sale_items;

-- ============================================================
-- CATATAN PENTING:
-- Setelah menjalankan script ini, kolom 'cost' di sale_items
-- akan otomatis terisi setiap kali kasir menyelesaikan transaksi.
-- Nilai HPP di-snapshot pada saat transaksi terjadi,
-- sehingga perubahan HPP di bulan berikutnya TIDAK akan
-- mengubah laporan laba rugi bulan-bulan sebelumnya.
-- ============================================================
