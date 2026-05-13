-- ==========================================
-- FIX STOCK TRIGGERS (V9 - PERSISTENT HISTORY)
-- When an item is deleted or sale is cancelled:
-- DO NOT delete the original "OUT" movement.
-- Instead, ADD a new "IN" movement as a reversal.
-- ==========================================

-- 1. UNIFIED STOCK HANDLER FUNCTION (V9)
CREATE OR REPLACE FUNCTION fn_handle_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id BIGINT;
    v_quantity_diff NUMERIC;
    v_is_delete BOOLEAN := (TG_OP = 'DELETE');
    v_is_insert BOOLEAN := (TG_OP = 'INSERT');
    v_is_update BOOLEAN := (TG_OP = 'UPDATE');
    r_recipe RECORD;
    v_product_name TEXT;
    v_branch_id INTEGER;
    v_new_stock NUMERIC;
    v_sale_status TEXT;
    v_sale_id BIGINT; 
    v_sale_item_id BIGINT;
    v_reason_prefix TEXT := '';
BEGIN
    -- Get sale status and info
    IF v_is_delete THEN
        v_sale_id := OLD.sale_id;
        v_sale_item_id := OLD.id;
        v_product_id := OLD.product_id;
        v_quantity_diff := -OLD.quantity;
        v_reason_prefix := '[Hapus Item] ';
    ELSE
        v_sale_id := NEW.sale_id;
        v_sale_item_id := NEW.id;
        v_product_id := NEW.product_id;
        IF v_is_insert THEN
            v_quantity_diff := NEW.quantity;
        ELSE
            v_quantity_diff := NEW.quantity - OLD.quantity;
            v_reason_prefix := '[Revisi] ';
        END IF;
    END IF;

    -- Safety check for sale existence
    SELECT status INTO v_sale_status FROM sales WHERE id = v_sale_id;
    v_sale_status := LOWER(COALESCE(v_sale_status, 'hold'));

    -- CASE: DELETE
    IF v_is_delete THEN
        -- If sale was NOT completed, there was likely no OUT movement.
        -- Clean up any crumbs just in case it was briefly completed then reverted.
        IF v_sale_status NOT IN ('completed', 'selesai', 'slesai') THEN
            DELETE FROM stock_movements WHERE sale_item_id = v_sale_item_id;
            RETURN OLD;
        END IF;
        
        -- IF it WAS completed, we DO NOT DELETE anything.
        -- We continue to the rest of the function to INSERT an 'IN' movement.
    END IF;

    -- CASE: INSERT or UPDATE or (Completed DELETE)
    -- Only process stock if sale is COMPLETED
    IF v_sale_status NOT IN ('completed', 'selesai', 'slesai') THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- If no change in quantity, do nothing
    IF v_quantity_diff = 0 THEN
        RETURN NEW;
    END IF;

    -- Get product info
    SELECT branch_id, name INTO v_branch_id, v_product_name FROM products WHERE id = v_product_id;

    -- PROCESS STOCK MOVEMENTS (Either Recipe or Direct)
    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = v_product_id) THEN
        FOR r_recipe IN SELECT ingredient_id, amount FROM product_recipes WHERE product_id = v_product_id LOOP
            DECLARE
                v_total_diff NUMERIC := r_recipe.amount * v_quantity_diff;
                v_ing_name TEXT; v_ing_unit TEXT;
                v_move_type TEXT;
            BEGIN
                SELECT name, unit INTO v_ing_name, v_ing_unit FROM ingredients WHERE id = r_recipe.ingredient_id;
                
                -- Update Ingredient Stock
                UPDATE ingredients 
                SET current_stock = current_stock - v_total_diff, 
                    last_updated = CURRENT_DATE 
                WHERE id = r_recipe.ingredient_id
                RETURNING current_stock INTO v_new_stock;
                
                v_move_type := CASE WHEN v_total_diff > 0 THEN 'OUT' ELSE 'IN' END;

                -- Record Movement
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user", sale_item_id)
                VALUES (r_recipe.ingredient_id, v_ing_name, v_branch_id, v_move_type, ABS(v_total_diff), v_ing_unit, 
                    v_reason_prefix || v_product_name || ' (' || ABS(v_quantity_diff) || ')', 'System', v_sale_item_id);

                -- Sync back to Product stock if 1-to-1
                IF r_recipe.amount = 1 THEN
                    UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
                END IF;
            END;
        END LOOP;
    ELSE
        -- Auto-Match by Name
        DECLARE
            v_match_id BIGINT; v_match_name TEXT; v_match_unit TEXT;
            v_move_type TEXT;
        BEGIN
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit FROM ingredients 
            WHERE (LOWER(TRIM(name)) = LOWER(TRIM(v_product_name)) OR code = v_product_name) 
              AND (branch_id = v_branch_id OR branch_id IS NULL) 
            ORDER BY (branch_id = v_branch_id) DESC LIMIT 1;
            
            v_move_type := CASE WHEN v_quantity_diff > 0 THEN 'OUT' ELSE 'IN' END;

            IF v_match_id IS NOT NULL THEN
                UPDATE ingredients SET current_stock = current_stock - v_quantity_diff, last_updated = CURRENT_DATE WHERE id = v_match_id RETURNING current_stock INTO v_new_stock;
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user", sale_item_id)
                VALUES (v_match_id, v_match_name, v_branch_id, v_move_type, ABS(v_quantity_diff), v_match_unit, v_reason_prefix || v_product_name || ' [Auto]', 'System', v_sale_item_id);
                UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
            ELSE
                -- Direct Product Stock
                UPDATE products SET stock = stock - v_quantity_diff WHERE id = v_product_id;
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user", sale_item_id)
                VALUES (NULL, v_product_name, v_branch_id, v_move_type, ABS(v_quantity_diff), 'pcs', v_reason_prefix || v_product_name || ' [Direct]', 'System', v_sale_item_id);
            END IF;
        END;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER ON SALES TABLE (For status changes)
CREATE OR REPLACE FUNCTION fn_handle_sale_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changes to COMPLETED, trigger stock deduction for all items
    IF (LOWER(NEW.status) IN ('completed', 'selesai', 'slesai')) AND 
       (LOWER(COALESCE(OLD.status, 'hold')) NOT IN ('completed', 'selesai', 'slesai')) THEN
        UPDATE sale_items SET quantity = quantity WHERE sale_id = NEW.id;
        
    -- If status changes FROM completed to something else (cancelled/hold), record reversals
    ELSIF (LOWER(OLD.status) IN ('completed', 'selesai', 'slesai')) AND 
          (LOWER(NEW.status) NOT IN ('completed', 'selesai', 'slesai')) THEN
        
        -- Logic: We need to reverse stock for all items.
        -- To KEEP HISTORY, we manually insert "IN" movements here.
        
        -- Record reversals for each movement
        INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user", sale_item_id)
        SELECT 
            sm.ingredient_id, 
            sm.ingredient_name, 
            sm.branch_id, 
            'IN', 
            sm.quantity, 
            sm.unit, 
            '[Batal Transaksi] ' || sm.reason, 
            'System', 
            sm.sale_item_id
        FROM stock_movements sm
        JOIN sale_items si ON sm.sale_item_id = si.id
        WHERE si.sale_id = NEW.id AND sm.type = 'OUT';

        -- Update actual stock levels
        -- For ingredients
        UPDATE ingredients i
        SET current_stock = i.current_stock + sub.total_qty,
            last_updated = CURRENT_DATE
        FROM (
            SELECT ingredient_id, SUM(quantity) as total_qty 
            FROM stock_movements sm
            JOIN sale_items si ON sm.sale_item_id = si.id
            WHERE si.sale_id = NEW.id AND sm.type = 'OUT' AND sm.ingredient_id IS NOT NULL
            GROUP BY ingredient_id
        ) sub
        WHERE i.id = sub.ingredient_id;

        -- For products (Direct stock)
        UPDATE products p
        SET stock = p.stock + sub.total_qty
        FROM (
            SELECT product_id, SUM(quantity) as total_qty
            FROM sale_items
            WHERE sale_id = NEW.id
            GROUP BY product_id
        ) sub
        WHERE p.id = sub.product_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. APPLY TRIGGERS
DROP TRIGGER IF EXISTS tr_sale_status_stock ON sales;
CREATE TRIGGER tr_sale_status_stock
AFTER UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION fn_handle_sale_status_change();

DROP TRIGGER IF EXISTS tr_stock_movement ON sale_items;
CREATE TRIGGER tr_stock_movement 
AFTER INSERT OR UPDATE OR DELETE ON sale_items 
FOR EACH ROW EXECUTE FUNCTION fn_handle_stock_movement();
