-- =============================================================
-- Tahap 1: Tambah kolom idempotency untuk checkout mobile
-- Aman dijalankan lebih dulu karena tidak mengubah transaksi lama.
-- =============================================================

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS client_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_transaction_id_unique
ON public.sales(client_transaction_id)
WHERE client_transaction_id IS NOT NULL;
