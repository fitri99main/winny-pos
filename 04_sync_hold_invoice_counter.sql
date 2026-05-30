-- =============================================================
-- FOLLOW-UP: SYNC HOLD INVOICE COUNTER
-- Dibuat setelah verifikasi live pada 2026-05-21.
-- Tujuan:
-- 1. Menyelaraskan store_settings.hold_invoice_last_number
-- 2. Mencegah nomor HOLD lama terulang pada transaksi berikutnya
-- Aman dijalankan berulang saat jam transaksi sepi.
-- =============================================================

BEGIN;

ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS hold_invoice_prefix TEXT DEFAULT 'HOLD',
ADD COLUMN IF NOT EXISTS hold_invoice_last_number BIGINT DEFAULT 0;

INSERT INTO public.store_settings (id, hold_invoice_prefix, hold_invoice_last_number)
VALUES (1, 'HOLD', 0)
ON CONFLICT (id) DO NOTHING;

UPDATE public.store_settings
SET hold_invoice_prefix = COALESCE(NULLIF(hold_invoice_prefix, ''), 'HOLD')
WHERE id = 1;

WITH current_settings AS (
  SELECT
    id,
    COALESCE(NULLIF(hold_invoice_prefix, ''), 'HOLD') AS active_prefix
  FROM public.store_settings
  WHERE id = 1
),
derived_counter AS (
  SELECT
    cs.id,
    cs.active_prefix,
    COALESCE(MAX(CAST(SUBSTRING(s.order_no FROM '([0-9]+)$') AS BIGINT)), 0) AS max_hold_no
  FROM current_settings cs
  LEFT JOIN public.sales s
    ON s.order_no LIKE cs.active_prefix || '-%'
  GROUP BY cs.id, cs.active_prefix
)
UPDATE public.store_settings ss
SET
  hold_invoice_prefix = dc.active_prefix,
  hold_invoice_last_number = dc.max_hold_no
FROM derived_counter dc
WHERE ss.id = dc.id;

COMMIT;

-- Verifikasi setelah eksekusi:
SELECT
  id,
  hold_invoice_prefix,
  hold_invoice_last_number
FROM public.store_settings
WHERE id = 1;

SELECT
  order_no,
  status,
  date
FROM public.sales
WHERE order_no LIKE (
  SELECT COALESCE(NULLIF(hold_invoice_prefix, ''), 'HOLD') || '-%'
  FROM public.store_settings
  WHERE id = 1
)
ORDER BY id DESC
LIMIT 10;
