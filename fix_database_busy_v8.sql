-- OPTIMASI DATABASE v8 (ANTI-SIBUK)
-- 1. Tambah Indeks agar pencarian transaksi sangat cepat dan tidak mengunci tabel lama-lama
CREATE INDEX IF NOT EXISTS idx_sales_order_no ON public.sales(order_no);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);

-- 2. BERSIHKAN FUNGSI LAMA (Cegah konflik best candidate)
DROP FUNCTION IF EXISTS public.upsert_sale_with_items(jsonb, jsonb, bigint);
DROP FUNCTION IF EXISTS public.upsert_sale_with_items_v6(jsonb);
DROP FUNCTION IF EXISTS public.upsert_sale_with_items_v7(jsonb);

-- 3. FUNGSI ATOMIK v8 (ROBUST & FAST)
CREATE OR REPLACE FUNCTION upsert_sale_with_items(
  p_sale_data JSONB,
  p_items_data JSONB,
  p_target_sale_id BIGINT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_sale_id BIGINT;
  v_order_no TEXT;
  v_settings RECORD;
  v_status TEXT;
  v_branch_id BIGINT;
  v_result JSONB;
BEGIN
  -- Ambil pengaturan dasar
  SELECT * INTO v_settings FROM store_settings WHERE id = 1;
  v_status := COALESCE(p_sale_data->>'status', 'Pending');
  v_branch_id := (p_sale_data->>'branch_id')::BIGINT;
  v_order_no := p_sale_data->>'order_no';

  -- GENERASI NOMOR ORDER OTOMATIS (Jika belum ada)
  IF v_order_no IS NULL OR v_order_no = '' THEN
    IF v_status = 'Pending' THEN
       v_order_no := COALESCE(v_settings.hold_invoice_prefix, 'HLD') || '-' || LPAD((v_settings.hold_invoice_last_number + 1)::TEXT, 5, '0');
       UPDATE store_settings SET hold_invoice_last_number = hold_invoice_last_number + 1 WHERE id = 1;
    ELSE
       v_order_no := COALESCE(v_settings.invoice_prefix, 'INV') || '-' || LPAD((v_settings.invoice_last_number + 1)::TEXT, 5, '0');
       UPDATE store_settings SET invoice_last_number = invoice_last_number + 1 WHERE id = 1;
    END IF;
  END IF;

  -- UPSERT KE TABEL SALES
  IF p_target_sale_id IS NOT NULL AND p_target_sale_id > 0 THEN
    UPDATE sales SET
      branch_id = v_branch_id,
      customer_id = (p_sale_data->>'customer_id')::BIGINT,
      customer_name = COALESCE(p_sale_data->>'customer_name', 'Guest'),
      table_no = COALESCE(p_sale_data->>'table_no', '-'),
      waiter_name = COALESCE(p_sale_data->>'waiter_name', 'Kasir'),
      total_amount = COALESCE((p_sale_data->>'total_amount')::DECIMAL, 0),
      discount = COALESCE((p_sale_data->>'discount')::DECIMAL, 0),
      tax = COALESCE((p_sale_data->>'tax')::DECIMAL, 0),
      service_charge = COALESCE((p_sale_data->>'service_charge')::DECIMAL, 0),
      status = v_status,
      payment_method = COALESCE(p_sale_data->>'payment_method', 'Tunai'),
      paid_amount = COALESCE((p_sale_data->>'paid_amount')::DECIMAL, 0),
      change = COALESCE((p_sale_data->>'change')::DECIMAL, 0),
      date = NOW(),
      order_no = v_order_no
    WHERE id = p_target_sale_id
    RETURNING id INTO v_sale_id;
  ELSE
    INSERT INTO sales (
      branch_id, customer_id, customer_name, table_no, waiter_name,
      total_amount, discount, tax, service_charge, status,
      payment_method, paid_amount, change, date, order_no
    ) VALUES (
      v_branch_id, 
      (p_sale_data->>'customer_id')::BIGINT,
      COALESCE(p_sale_data->>'customer_name', 'Guest'),
      COALESCE(p_sale_data->>'table_no', '-'),
      COALESCE(p_sale_data->>'waiter_name', 'Kasir'),
      COALESCE((p_sale_data->>'total_amount')::DECIMAL, 0),
      COALESCE((p_sale_data->>'discount')::DECIMAL, 0),
      COALESCE((p_sale_data->>'tax')::DECIMAL, 0),
      COALESCE((p_sale_data->>'service_charge')::DECIMAL, 0),
      v_status,
      COALESCE(p_sale_data->>'payment_method', 'Tunai'),
      COALESCE((p_sale_data->>'paid_amount')::DECIMAL, 0),
      COALESCE((p_sale_data->>'change')::DECIMAL, 0),
      NOW(),
      v_order_no
    ) RETURNING id INTO v_sale_id;
  END IF;

  -- RE-INSERT ITEMS (FAST)
  DELETE FROM sale_items WHERE sale_id = v_sale_id;
  
  INSERT INTO sale_items (sale_id, product_id, product_name, price, quantity, notes, target)
  SELECT 
    v_sale_id, 
    (x->>'product_id')::BIGINT,
    (x->>'product_name'),
    (x->>'price')::DECIMAL,
    (x->>'quantity')::INTEGER,
    (x->>'notes'),
    (x->>'target')
  FROM jsonb_array_elements(p_items_data) AS x;

  -- KEMBALIKAN HASIL
  RETURN jsonb_build_object(
    'id', v_sale_id,
    'order_no', v_order_no,
    'status', 'success'
  );
END;
$$ LANGUAGE plpgsql;
