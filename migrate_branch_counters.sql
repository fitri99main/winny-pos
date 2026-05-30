-- 1. Tambahkan kolom ke tabel branches
ALTER TABLE public.branches 
ADD COLUMN IF NOT EXISTS invoice_last_number BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS hold_invoice_last_number BIGINT DEFAULT 0;

-- 2. Inisialisasi counter berdasarkan data transaksi yang sudah ada di tabel sales
UPDATE public.branches b
SET 
  invoice_last_number = COALESCE((
    SELECT MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT))
    FROM public.sales
    WHERE branch_id = b.id 
      AND order_no NOT LIKE 'HOLD-%'
      AND order_no ~ '[0-9]+$'
  ), 0),
  hold_invoice_last_number = COALESCE((
    SELECT MAX(CAST(SUBSTRING(order_no FROM '([0-9]+)$') AS BIGINT))
    FROM public.sales
    WHERE branch_id = b.id 
      AND order_no LIKE 'HOLD-%'
      AND order_no ~ '[0-9]+$'
  ), 0);
