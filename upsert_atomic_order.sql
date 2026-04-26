-- SMART ATOMIC UPSERT (v5 - SAFE LOCAL VARIABLES)
-- This version uses 'l_' prefix to ensure zero conflict with table names.

CREATE OR REPLACE FUNCTION public.upsert_sale_with_items(
  p_sale_data JSONB,
  p_items_data JSONB[],
  p_target_sale_id BIGINT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    l_sale_id BIGINT;
    l_sale_record RECORD;
    l_item_json JSONB;
    l_updated BOOLEAN := FALSE;
    l_order_no TEXT;
    l_prefix TEXT;
    l_last_no INTEGER;
    l_next_no INTEGER;
    l_status TEXT;
BEGIN
    l_status := COALESCE(p_sale_data->>'status', 'Pending');
    l_order_no := p_sale_data->>'order_no';

    -- 1. SERVER-SIDE NUMBERING FOR NEW ORDERS
    IF (l_order_no IS NULL OR l_order_no = '') AND p_target_sale_id IS NULL THEN
        -- Fetch settings row. 
        -- If no row with id=1 exists, we provide hardcoded fallbacks.
        SELECT invoice_prefix, invoice_last_number 
        INTO l_prefix, l_last_no 
        FROM public.store_settings 
        WHERE id = 1 FOR UPDATE;

        l_prefix := COALESCE(l_prefix, 'ORD');
        l_last_no := COALESCE(l_last_no, 0);

        -- Force ORD for all status (as requested)
        IF l_status = 'Pending' OR l_status = 'Paid' THEN
           l_prefix := 'ORD';
        END IF;

        l_next_no := l_last_no + 1;
        l_order_no := l_prefix || '-' || LPAD(l_next_no::TEXT, 5, '0');

        -- Persist the next number
        UPDATE public.store_settings SET invoice_last_number = l_next_no WHERE id = 1;
    END IF;

    -- 2. Try to Update if ID is provided
    IF p_target_sale_id IS NOT NULL THEN
        UPDATE public.sales SET
            order_no = COALESCE(l_order_no, order_no),
            branch_id = COALESCE((p_sale_data->>'branch_id')::INTEGER, branch_id),
            customer_name = COALESCE(p_sale_data->>'customer_name', customer_name),
            customer_id = COALESCE((p_sale_data->>'customer_id')::BIGINT, customer_id),
            table_no = COALESCE(p_sale_data->>'table_no', table_no),
            waiter_name = COALESCE(p_sale_data->>'waiter_name', waiter_name),
            total_amount = COALESCE((p_sale_data->>'total_amount')::NUMERIC, total_amount),
            status = l_status,
            payment_method = COALESCE(p_sale_data->>'payment_method', payment_method),
            discount = COALESCE((p_sale_data->>'discount')::NUMERIC, discount),
            tax = COALESCE((p_sale_data->>'tax')::NUMERIC, tax),
            service_charge = COALESCE((p_sale_data->>'service_charge')::NUMERIC, service_charge),
            date = COALESCE((p_sale_data->>'date')::TIMESTAMPTZ, date),
            paid_amount = COALESCE((p_sale_data->>'paid_amount')::NUMERIC, paid_amount),
            "change" = COALESCE((p_sale_data->>'change')::NUMERIC, "change"),
            notes = COALESCE(p_sale_data->>'notes', notes)
        WHERE id = p_target_sale_id
        RETURNING * INTO l_sale_record;
        
        IF FOUND THEN
            l_sale_id := p_target_sale_id;
            l_updated := TRUE;
            DELETE FROM public.sale_items WHERE sale_id = l_sale_id;
        END IF;
    END IF;

    -- 3. Fallback to Insert if not updated
    IF NOT l_updated THEN
        INSERT INTO public.sales (
            order_no, branch_id, customer_name, customer_id, 
            table_no, waiter_name, total_amount, status, 
            payment_method, discount, tax, service_charge, date,
            paid_amount, "change", notes
        ) VALUES (
            l_order_no,
            COALESCE((p_sale_data->>'branch_id')::INTEGER, 1),
            COALESCE(p_sale_data->>'customer_name', 'Guest'),
            (p_sale_data->>'customer_id')::BIGINT,
            COALESCE(p_sale_data->>'table_no', '-'),
            COALESCE(p_sale_data->>'waiter_name', 'Kasir'),
            COALESCE((p_sale_data->>'total_amount')::NUMERIC, 0),
            l_status,
            COALESCE(p_sale_data->>'payment_method', 'Tunai'),
            COALESCE((p_sale_data->>'discount')::NUMERIC, 0),
            COALESCE((p_sale_data->>'tax')::NUMERIC, 0),
            COALESCE((p_sale_data->>'service_charge')::NUMERIC, 0),
            COALESCE((p_sale_data->>'date')::TIMESTAMPTZ, now()),
            COALESCE((p_sale_data->>'paid_amount')::NUMERIC, 0),
            COALESCE((p_sale_data->>'change')::NUMERIC, 0),
            p_sale_data->>'notes'
        ) RETURNING * INTO l_sale_record;
        
        l_sale_id := l_sale_record.id;
    END IF;

    -- 4. Insert Items
    IF array_length(p_items_data, 1) > 0 THEN
        FOR i IN 1 .. array_length(p_items_data, 1) LOOP
            l_item_json := p_items_data[i];
            
            INSERT INTO public.sale_items (
                sale_id, product_id, product_name, quantity, 
                price, cost, target, status, is_taxed, notes
            ) VALUES (
                l_sale_id,
                (l_item_json->>'product_id')::BIGINT,
                l_item_json->>'product_name',
                (l_item_json->>'quantity')::NUMERIC,
                (l_item_json->>'price')::NUMERIC,
                COALESCE((l_item_json->>'cost')::NUMERIC, 0),
                COALESCE(l_item_json->>'target', 'Kitchen'),
                COALESCE(l_item_json->>'status', 'Pending'),
                COALESCE((l_item_json->>'is_taxed')::BOOLEAN, false),
                COALESCE(l_item_json->>'notes', '')
            );
        END LOOP;
    END IF;

    RETURN to_jsonb(l_sale_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
