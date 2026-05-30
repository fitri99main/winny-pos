-- =============================================================
-- FOLLOW-UP: DISABLE WIFI VOUCHERS WHEN POOL IS EMPTY
-- Dibuat setelah verifikasi live pada 2026-05-21.
-- Temuan live:
-- - enable_wifi_vouchers = true
-- - tabel public.wifi_vouchers kosong
-- - transaksi qualifying tidak menerima voucher
--
-- Tujuan:
-- 1. Menghindari fitur voucher aktif palsu
-- 2. Mengurangi kebingungan saat checkout / cetak struk
-- Jalankan hanya jika memang belum siap mengisi pool voucher.
-- =============================================================

BEGIN;

ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS enable_wifi_vouchers BOOLEAN DEFAULT FALSE;

WITH voucher_pool AS (
  SELECT COUNT(*)::BIGINT AS total_rows
  FROM public.wifi_vouchers
),
target_setting AS (
  SELECT id
  FROM public.store_settings
  WHERE id = 1
)
UPDATE public.store_settings ss
SET enable_wifi_vouchers = FALSE
FROM voucher_pool vp, target_setting ts
WHERE ss.id = ts.id
  AND vp.total_rows = 0
  AND ss.enable_wifi_vouchers IS DISTINCT FROM FALSE;

COMMIT;

-- Verifikasi setelah eksekusi:
SELECT
  id,
  enable_wifi_vouchers,
  wifi_voucher_min_amount,
  wifi_voucher_multiplier,
  wifi_voucher_notice
FROM public.store_settings
WHERE id = 1;

SELECT
  COUNT(*) AS voucher_pool_total,
  COUNT(*) FILTER (WHERE is_used = FALSE) AS voucher_pool_unused
FROM public.wifi_vouchers;
