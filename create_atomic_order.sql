-- ATOMIC ORDER CREATION FUNCTION
-- Run this in your Supabase Dashboard SQL Editor

CREATE OR REPLACE FUNCTION public.create_sale_with_items(
  p_sale_data JSONB,
  p_items_data JSONB[]
) RETURNS JSONB AS $$
DECLARE
    v_sale_record RECORD;
    v_item_json JSONB;
BEGIN
    -- 1. Insert Sales record
    INSERT INTO public.sales (
        order_no, 
        branch_id, 
        customer_name, 
        customer_id, 
        table_no, 
        waiter_name, 
        total_amount, 
        status, 
        payment_method, 
        discount, 
        tax, 
        service_charge, 
        date,
        paid_amount, 
        "change",
        notes
    ) VALUES (
        p_sale_data->>'order_no',
        (p_sale_data->>'branch_id')::INTEGER,
        COALESCE(p_sale_data->>'customer_name', 'Guest'),
        (p_sale_data->>'customer_id')::BIGINT,
        COALESCE(p_sale_data->>'table_no', '-'),
        COALESCE(p_sale_data->>'waiter_name', 'Kasir'),
        (p_sale_data->>'total_amount')::NUMERIC,
        COALESCE(p_sale_data->>'status', 'Pending'),
        COALESCE(p_sale_data->>'payment_method', 'Tunai'),
        COALESCE((p_sale_data->>'discount')::NUMERIC, 0),
        COALESCE((p_sale_data->>'tax')::NUMERIC, 0),
        COALESCE((p_sale_data->>'service_charge')::NUMERIC, 0),
        COALESCE((p_sale_data->>'date')::TIMESTAMPTZ, now()),
        COALESCE((p_sale_data->>'paid_amount')::NUMERIC, 0),
        COALESCE((p_sale_data->>'change')::NUMERIC, 0),
        p_sale_data->>'notes'
    ) RETURNING * INTO v_sale_record;

    -- 2. Insert Sale Items
    FOR i IN 1 .. array_length(p_items_data, 1) LOOP
        v_item_json := p_items_data[i];
        
        INSERT INTO public.sale_items (
            sale_id, 
            product_id, 
            product_name, 
            quantity, 
            price, 
            cost, 
            target, 
            status, 
            is_taxed, 
            notes
        ) VALUES (
            v_sale_record.id,
            (v_item_json->>'product_id')::BIGINT,
            v_item_json->>'product_name',
            (v_item_json->>'quantity')::NUMERIC,
            (v_item_json->>'price')::NUMERIC,
            COALESCE((v_item_json->>'cost')::NUMERIC, 0),
            COALESCE(v_item_json->>'target', 'Waitress'),
            COALESCE(v_item_json->>'status', 'Pending'),
            COALESCE((v_item_json->>'is_taxed')::BOOLEAN, false),
            COALESCE(v_item_json->>'notes', '')
        );
    END LOOP;

    RETURN to_jsonb(v_sale_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
