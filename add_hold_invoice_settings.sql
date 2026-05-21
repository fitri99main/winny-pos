-- Add hold invoice numbering settings to store_settings
-- Needed by upsert_sale_with_items when saving Pending/Hold orders.

ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS hold_invoice_prefix TEXT DEFAULT 'HOLD',
ADD COLUMN IF NOT EXISTS hold_invoice_last_number BIGINT DEFAULT 0;

UPDATE public.store_settings
SET
  hold_invoice_prefix = COALESCE(NULLIF(hold_invoice_prefix, ''), 'HOLD'),
  hold_invoice_last_number = COALESCE(hold_invoice_last_number, 0)
WHERE id = 1;

INSERT INTO public.store_settings (id, hold_invoice_prefix, hold_invoice_last_number)
VALUES (1, 'HOLD', 0)
ON CONFLICT (id) DO NOTHING;

UPDATE public.store_settings s
SET hold_invoice_last_number = GREATEST(
  COALESCE(s.hold_invoice_last_number, 0),
  COALESCE((
    SELECT MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT))
    FROM public.sales
    WHERE order_no LIKE COALESCE(NULLIF(s.hold_invoice_prefix, ''), 'HOLD') || '-%'
  ), 0)
)
WHERE s.id = 1;

COMMENT ON COLUMN public.store_settings.hold_invoice_prefix IS 'Prefix nomor invoice untuk transaksi HOLD/Pending';
COMMENT ON COLUMN public.store_settings.hold_invoice_last_number IS 'Nomor terakhir yang dipakai untuk invoice HOLD/Pending';
