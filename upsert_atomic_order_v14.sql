-- Fungsi Upsert Sale with Items (v16 - COLLISION PREVENTION & LOCKING)
CREATE OR REPLACE FUNCTION upsert_sale_with_items(
  p_sale_data JSONB,
  p_items_data JSONB,
  p_target_sale_id BIGINT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_sale_id BIGINT;
  v_order_no TEXT;
  v_item_json JSONB;
  v_result JSONB;
  v_status TEXT;
  v_branch_id BIGINT;
  v_customer_id BIGINT;
  v_exists BOOLEAN;
  
  -- Settings from store_settings
  v_inv_mode TEXT;
  v_inv_prefix TEXT;
  v_inv_last_no INTEGER;
  v_hold_prefix TEXT;
  v_hold_last_no INTEGER;
  v_next_no INTEGER;
  
  -- Item fields
  v_product_id BIGINT;
  v_product_name TEXT;
  v_price DECIMAL;
  v_quantity INTEGER;
  v_notes TEXT;
  v_target TEXT;
BEGIN
  -- 1. Ambil & Validasi Data Dasar
  v_status := COALESCE(p_sale_data->>'status', 'Pending');
  v_branch_id := (p_sale_data->>'branch_id')::BIGINT;
  v_customer_id := (p_sale_data->>'customer_id')::BIGINT;
  v_order_no := p_sale_data->>'order_no';
  
  -- 2. Logika penomoran jika belum ada ATAU jika status berubah ke Paid (Invoice Baru)
  -- Jika transaksi diupdate dari Pending/Self-Service ke Paid, kita butuh Invoice No baru
  IF v_order_no IS NULL OR v_order_no = '' OR (LOWER(v_status) NOT IN ('pending', 'self-service', 'unpaid') AND v_order_no LIKE 'HOLD-%') THEN
    
    -- LOCK ROW untuk mencegah race condition
    SELECT 
        invoice_mode, invoice_prefix, invoice_last_number,
        hold_invoice_prefix, hold_invoice_last_number
    INTO 
        v_inv_mode, v_inv_prefix, v_inv_last_no,
        v_hold_prefix, v_hold_last_no
    FROM store_settings WHERE id = 1 FOR UPDATE;

    IF LOWER(v_status) IN ('pending', 'self-service', 'unpaid') THEN
        -- PENOMORAN HOLD / SELF-SERVICE
        v_hold_prefix := COALESCE(NULLIF(v_hold_prefix, ''), 'HOLD');
        v_hold_last_no := COALESCE(v_hold_last_no, 0);
        
        LOOP
            v_next_no := v_hold_last_no + 1;
            v_order_no := v_hold_prefix || '-' || LPAD(v_next_no::TEXT, 5, '0');
            
            -- Cek apakah nomor ini sudah ada
            SELECT EXISTS(SELECT 1 FROM sales WHERE branch_id = v_branch_id AND order_no = v_order_no) INTO v_exists;
            IF NOT v_exists THEN EXIT; END IF;
            v_hold_last_no := v_next_no; -- Coba nomor berikutnya
        END LOOP;
        
        UPDATE store_settings SET hold_invoice_last_number = v_next_no WHERE id = 1;
    ELSE
        -- PENOMORAN PAID/LUNAS
        v_inv_mode := COALESCE(v_inv_mode, 'auto');
        v_inv_prefix := COALESCE(v_inv_prefix, 'WIN-26');
        v_inv_last_no := COALESCE(v_inv_last_no, 0);

        IF v_inv_mode = 'auto' THEN
            LOOP
                v_next_no := v_inv_last_no + 1;
                v_order_no := v_inv_prefix || '-' || LPAD(v_next_no::TEXT, 4, '0');
                
                -- Cek apakah nomor ini sudah ada
                SELECT EXISTS(SELECT 1 FROM sales WHERE branch_id = v_branch_id AND order_no = v_order_no) INTO v_exists;
                IF NOT v_exists THEN EXIT; END IF;
                v_inv_last_no := v_next_no; -- Coba nomor berikutnya
            END LOOP;
            
            UPDATE store_settings SET invoice_last_number = v_next_no WHERE id = 1;
        ELSE
            v_order_no := v_inv_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW(), 'HH24MISS');
        END IF;
    END IF;
  END IF;

  -- 3. Upsert Tabel Sales
  v_sale_id := NULL;
  
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
  END IF;

  -- Jika Update Gagal atau tidak ada target, lakukan Insert Baru
  IF v_sale_id IS NULL THEN
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

  -- 4. Kelola Items
  IF v_sale_id IS NOT NULL AND jsonb_array_length(p_items_data) > 0 THEN
    DELETE FROM sale_items WHERE sale_id = v_sale_id;

    FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items_data) LOOP
      v_product_id := (v_item_json->>'product_id')::BIGINT;
      v_product_name := COALESCE(v_item_json->>'product_name', v_item_json->>'name', 'Produk');
      v_price := (v_item_json->>'price')::DECIMAL;
      v_quantity := (v_item_json->>'quantity')::INTEGER;
      v_notes := COALESCE(v_item_json->>'notes', '');
      v_target := COALESCE(v_item_json->>'target', 'Bar');

      IF v_product_name = 'Produk' AND v_product_id IS NOT NULL THEN
         SELECT name INTO v_product_name FROM products WHERE id = v_product_id;
         v_product_name := COALESCE(v_product_name, 'Produk');
      END IF;

      INSERT INTO sale_items (
        sale_id, product_id, product_name, price, quantity, notes, target
      ) VALUES (
        v_sale_id, v_product_id, v_product_name, v_price, v_quantity, v_notes, v_target
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id', v_sale_id, 'order_no', v_order_no, 'status', 'success');
END;
$$ LANGUAGE plpgsql;
