-- =============================================================
-- SYNC INVOICE SEQUENCE TO STORE SETTINGS
-- Jalankan file ini di Supabase SQL Editor untuk:
-- 1. Mengubah function upsert_sale_with_items agar selalu
--    menggunakan 'store_settings' sebagai referensi invoice
--    sehingga tidak akan terjadi nomor lompat.
-- =============================================================

CREATE OR REPLACE FUNCTION upsert_sale_with_items(
  p_sale_data JSONB,
  p_items_data JSONB,
  p_target_sale_id BIGINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id BIGINT;
  v_order_no TEXT;
  v_existing_order_no TEXT;
  v_item_json JSONB;
  v_status TEXT;
  v_branch_id BIGINT;
  v_customer_id BIGINT;
  v_client_transaction_id TEXT;
  v_requires_final_order_no BOOLEAN := FALSE;
  v_exists BOOLEAN := FALSE;

  v_inv_mode TEXT;
  v_inv_prefix TEXT;
  v_inv_last_no INTEGER;
  v_hold_prefix TEXT;
  v_hold_last_no INTEGER;
  v_next_no INTEGER;

  v_product_id BIGINT;
  v_product_name TEXT;
  v_price DECIMAL;
  v_quantity INTEGER;
  v_notes TEXT;
  v_target TEXT;
BEGIN
  v_status := COALESCE(p_sale_data->>'status', 'Pending');
  v_branch_id := (p_sale_data->>'branch_id')::BIGINT;
  v_customer_id := (p_sale_data->>'customer_id')::BIGINT;
  v_order_no := NULLIF(BTRIM(COALESCE(p_sale_data->>'order_no', '')), '');
  v_client_transaction_id := NULLIF(BTRIM(COALESCE(p_sale_data->>'client_transaction_id', '')), '');

  IF v_client_transaction_id IS NOT NULL AND COALESCE(p_target_sale_id, 0) <= 0 THEN
    SELECT id, order_no
    INTO v_sale_id, v_existing_order_no
    FROM public.sales
    WHERE client_transaction_id = v_client_transaction_id
    ORDER BY id DESC
    LIMIT 1;

    IF v_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', v_sale_id,
        'order_no', v_existing_order_no,
        'status', 'success',
        'idempotent', true
      );
    END IF;
  END IF;

  IF COALESCE(p_target_sale_id, 0) > 0 AND v_order_no IS NULL THEN
    SELECT order_no
    INTO v_order_no
    FROM public.sales
    WHERE id = p_target_sale_id;
  END IF;

  v_requires_final_order_no :=
    v_order_no IS NULL OR
    (
      LOWER(v_status) NOT IN ('pending', 'unpaid')
      AND COALESCE(v_order_no, '') LIKE 'HOLD-%'
    );

  IF v_requires_final_order_no THEN
    v_order_no := 'TMP-' || TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSMS') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
  END IF;

  v_sale_id := NULL;

  IF COALESCE(p_target_sale_id, 0) > 0 THEN
    UPDATE public.sales SET
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
      order_no = COALESCE(v_order_no, order_no),
      client_transaction_id = COALESCE(v_client_transaction_id, client_transaction_id)
    WHERE id = p_target_sale_id
    RETURNING id INTO v_sale_id;
  END IF;

  IF v_sale_id IS NULL THEN
    INSERT INTO public.sales (
      branch_id, customer_id, customer_name, table_no, waiter_name,
      total_amount, discount, tax, service_charge, status,
      payment_method, paid_amount, change, date, order_no, client_transaction_id
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
      v_order_no,
      v_client_transaction_id
    ) RETURNING id INTO v_sale_id;
  END IF;

  IF v_sale_id IS NOT NULL AND jsonb_array_length(p_items_data) > 0 THEN
    DELETE FROM public.sale_items WHERE sale_id = v_sale_id;

    FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items_data) LOOP
      BEGIN
        v_product_id := (v_item_json->>'product_id')::BIGINT;
      EXCEPTION WHEN OTHERS THEN
        v_product_id := NULL;
      END;

      v_product_name := COALESCE(v_item_json->>'product_name', v_item_json->>'name', 'Produk');
      v_price := (v_item_json->>'price')::DECIMAL;
      v_quantity := (v_item_json->>'quantity')::INTEGER;
      v_notes := COALESCE(v_item_json->>'notes', '');
      v_target := COALESCE(v_item_json->>'target', 'Bar');

      IF v_product_name = 'Produk' AND v_product_id IS NOT NULL THEN
        SELECT name INTO v_product_name FROM public.products WHERE id = v_product_id;
        v_product_name := COALESCE(v_product_name, 'Produk');
      END IF;

      INSERT INTO public.sale_items (
        sale_id, product_id, product_name, price, quantity, notes, target
      ) VALUES (
        v_sale_id, v_product_id, v_product_name, v_price, v_quantity, v_notes, v_target
      );
    END LOOP;
  END IF;

  IF v_requires_final_order_no THEN
    -- MENGUNCI STORE_SETTINGS AGAR SINKRON DENGAN VERSI WEB
    SELECT
      invoice_mode, invoice_prefix,
      invoice_last_number,
      hold_invoice_prefix,
      hold_invoice_last_number
    INTO
      v_inv_mode, v_inv_prefix,
      v_inv_last_no,
      v_hold_prefix,
      v_hold_last_no
    FROM public.store_settings
    WHERE id = 1
    FOR UPDATE;

    IF LOWER(v_status) IN ('pending', 'unpaid') THEN
      v_hold_prefix := COALESCE(NULLIF(v_hold_prefix, ''), 'HOLD');
      v_hold_last_no := COALESCE(v_hold_last_no, 0);

      LOOP
        v_next_no := v_hold_last_no + 1;
        v_order_no := v_hold_prefix || '-' || LPAD(v_next_no::TEXT, 5, '0');

        SELECT EXISTS(
          SELECT 1
          FROM public.sales
          WHERE order_no = v_order_no
        ) INTO v_exists;

        EXIT WHEN NOT v_exists;
        v_hold_last_no := v_next_no;
      END LOOP;

      UPDATE public.store_settings
      SET hold_invoice_last_number = v_next_no
      WHERE id = 1;
    ELSE
      v_inv_mode := COALESCE(v_inv_mode, 'auto');
      v_inv_prefix := COALESCE(v_inv_prefix, 'WIN-26');
      v_inv_last_no := COALESCE(v_inv_last_no, 0);

      IF v_inv_mode = 'auto' THEN
        LOOP
          v_next_no := v_inv_last_no + 1;
          v_order_no := v_inv_prefix || '-' || LPAD(v_next_no::TEXT, 4, '0');

          SELECT EXISTS(
            SELECT 1
            FROM public.sales
            WHERE order_no = v_order_no
          ) INTO v_exists;

          EXIT WHEN NOT v_exists;
          v_inv_last_no := v_next_no;
        END LOOP;

        UPDATE public.store_settings
        SET invoice_last_number = v_next_no
        WHERE id = 1;
      ELSE
        v_order_no := v_inv_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || TO_CHAR(NOW(), 'HH24MISS');
      END IF;
    END IF;

    UPDATE public.sales
    SET order_no = v_order_no
    WHERE id = v_sale_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_sale_id,
    'order_no', v_order_no,
    'status', 'success',
    'idempotent', false
  );
END;
$$;

ALTER FUNCTION public.upsert_sale_with_items(jsonb, jsonb, bigint) SECURITY DEFINER;
ALTER FUNCTION public.upsert_sale_with_items(jsonb, jsonb, bigint) SET search_path = public;
