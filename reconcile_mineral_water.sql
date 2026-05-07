-- ==========================================
-- RECONCILE STOCK FOR AIR MINERAL 600ML
-- Run this in Supabase SQL Editor to fix existing discrepancies
-- ==========================================

DO $$
DECLARE
    v_prod_id BIGINT;
    v_prod_name TEXT := 'Air Mineral 600mL'; -- Adjust if name is slightly different
    v_total_sold NUMERIC;
    v_total_logged NUMERIC;
    v_diff NUMERIC;
    v_ing_id BIGINT;
    v_ing_name TEXT;
    v_ing_unit TEXT;
    v_branch_id INTEGER;
BEGIN
    -- 1. Find Product (Try exact match first, then ILIKE)
    SELECT id, branch_id, name INTO v_prod_id, v_branch_id, v_prod_name FROM products WHERE LOWER(name) LIKE '%air mineral%600%ml%' LIMIT 1;
    
    IF v_prod_id IS NULL THEN
        RAISE NOTICE 'Product matching Air Mineral 600mL not found';
        RETURN;
    END IF;

    RAISE NOTICE 'Processing Product: % (ID: %)', v_prod_name, v_prod_id;

    -- 2. Total Sold in all sales
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold FROM sale_items WHERE product_id = v_prod_id;

    -- 3. Find Matching Ingredient
    SELECT id, name, unit INTO v_ing_id, v_ing_name, v_ing_unit FROM ingredients 
    WHERE (LOWER(TRIM(name)) = LOWER(TRIM(v_prod_name)) OR LOWER(name) LIKE '%air mineral%600%ml%')
      AND (branch_id = v_branch_id OR branch_id IS NULL) 
    LIMIT 1;

    -- 4. Total Logged in Stock Movements (OUT - IN)
    IF v_ing_id IS NOT NULL THEN
        SELECT COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE -quantity END), 0) 
        INTO v_total_logged 
        FROM stock_movements 
        WHERE ingredient_id = v_ing_id;
    ELSE
        SELECT COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE -quantity END), 0) 
        INTO v_total_logged 
        FROM stock_movements 
        WHERE LOWER(TRIM(ingredient_name)) = LOWER(TRIM(v_prod_name));
    END IF;

    v_diff := v_total_sold - v_total_logged;

    RAISE NOTICE 'Total Sold: %, Total Logged: %, Discrepancy: %', v_total_sold, v_total_logged, v_diff;

    IF v_diff != 0 THEN
        DECLARE
            v_move_type TEXT := CASE WHEN v_diff > 0 THEN 'OUT' ELSE 'IN' END;
        BEGIN
            RAISE NOTICE 'Inserting corrective % movement of %.', v_move_type, ABS(v_diff);
            
            INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
            VALUES (v_ing_id, COALESCE(v_ing_name, v_prod_name), v_branch_id, v_move_type, ABS(v_diff), COALESCE(v_ing_unit, 'pcs'), 'Reconciliation: Auto-fix for ' || v_prod_name, 'System');
            
            -- Also update ingredient stock if it's an ingredient
            IF v_ing_id IS NOT NULL THEN
                UPDATE ingredients SET current_stock = current_stock - v_diff WHERE id = v_ing_id;
                RAISE NOTICE 'Updated ingredient % stock.', v_ing_name;
            ELSE
                -- Update product stock directly
                UPDATE products SET stock = stock - v_diff WHERE id = v_prod_id;
                RAISE NOTICE 'Updated product % stock directly.', v_prod_name;
            END IF;
        END;
    ELSE
        RAISE NOTICE 'Stock is already in sync for %.', v_prod_name;
    END IF;
END $$;
