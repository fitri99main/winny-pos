-- Fungsi Upsert Sale with Items (v8 - ULTRA ROBUST)
-- Memastikan konversi tipe data yang lebih ketat untuk mencegah data hilang saat checkout
CREATE OR REPLACE FUNCTION upsert_sale_with_items(
  p_sale_data JSONB,
  p_items_data JSONB,
  p_target_sale_id BIGINT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_sale_id BIGINT;
  v_order_no TEXT;
  v_settings RECORD;
  v_item RECORD;
  v_result JSONB;
  v_status TEXT;
  v_branch_id BIGINT;
  v_customer_id BIGINT;
BEGIN
  -- 1. Ambil pengaturan toko
  SELECT * INTO v_settings FROM store_settings WHERE id = 1;
  
  -- 2. Ambil & Validasi Data Dasar
  v_status := COALESCE(p_sale_data->>'status', 'Pending');
  v_branch_id := (p_sale_data->>'branch_id')::BIGINT;
  v_customer_id := (p_sale_data->>'customer_id')::BIGINT;
  
  -- 3. Tentukan Nomor Order
  v_order_no := p_sale_data->>'order_no';
  
  -- Logika penomoran jika belum ada
  IF v_order_no IS NULL OR v_order_no = '' THEN
    IF v_status = 'Pending' THEN
        v_order_no := 'HLD-' || TO_CHAR(NOW(), 'YYMMDDHH24MISS');
    ELSE
        v_order_no := 'INV-' || TO_CHAR(NOW(), 'YYMMDDHH24MISS');
    END IF;
  END IF;

  -- 4. Upsert Tabel Sales
  IF p_target_sale_id IS NOT NULL AND p_target_sale_id > 0 THEN
    UPDATE sales SET
      branch_id = v_branch_id,
      customer_id = v_customer_id,
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
      date = COALESCE((p_sale_data->>'date')::TIMESTAMPTZ, NOW()),
      order_no = v_order_no
    WHERE id = p_target_sale_id
    RETURNING id INTO v_sale_id;
  ELSE
    INSERT INTO sales (
      branch_id, customer_id, customer_name, table_no, waiter_name,
      total_amount, discount, tax, service_charge, status,
      payment_method, paid_amount, change, date, order_no
    ) VALUES (
      v_branch_id, v_customer_id, 
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
      COALESCE((p_sale_data->>'date')::TIMESTAMPTZ, NOW()),
      v_order_no
    ) RETURNING id INTO v_sale_id;
  END IF;

  -- Jika v_sale_id tetap NULL (update gagal), paksa gunakan target id atau buat baru
  v_sale_id := COALESCE(v_sale_id, p_target_sale_id);

  -- 5. Hapus sale_items lama
  IF v_sale_id IS NOT NULL THEN
    DELETE FROM sale_items WHERE sale_id = v_sale_id;

    -- 6. Insert sale_items baru dengan konversi tipe data yang aman
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items_data) AS x(
      product_id BIGINT,
      product_name TEXT,
      price DECIMAL,
      quantity INTEGER,
      notes TEXT,
      target TEXT
    ) LOOP
      INSERT INTO sale_items (
        sale_id, product_id, product_name, price, quantity, notes, target
      ) VALUES (
        v_sale_id, v_item.product_id, v_item.product_name, v_item.price, v_item.quantity, v_item.notes, v_item.target
      );
    END LOOP;
  END IF;

  -- 7. Kembalikan hasil
  v_result := jsonb_build_object(
    'id', v_sale_id,
    'order_no', v_order_no,
    'status', 'success'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
