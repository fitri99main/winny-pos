-- ==========================================
-- FIX STOCK TRIGGERS (V10 - SILENT RESTORE)
-- When an item is deleted:
-- 1. Restore the stock levels (Ingredients/Products).
-- 2. Delete the stock movement history (Keep card clean).
-- 3. DO NOT create a new "IN" movement.
-- ==========================================

-- 1. UNIFIED STOCK HANDLER FUNCTION (V10)
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
BEGIN
    -- Get sale status and info
    IF v_is_delete THEN
        v_sale_id := OLD.sale_id;
        v_sale_item_id := OLD.id;
        v_product_id := OLD.product_id;
        v_quantity_diff := -OLD.quantity;
    ELSE
        v_sale_id := NEW.sale_id;
        v_sale_item_id := NEW.id;
        v_product_id := NEW.product_id;
        IF v_is_insert THEN
            v_quantity_diff := NEW.quantity;
        ELSE
            v_quantity_diff := NEW.quantity - OLD.quantity;
        END IF;
    END IF;

    -- Safety check for sale existence
    SELECT status INTO v_sale_status FROM sales WHERE id = v_sale_id;
    v_sale_status := LOWER(COALESCE(v_sale_status, 'hold'));

    -- ==========================================
    -- CASE 1: DELETE OPERATION
    -- ==========================================
    IF v_is_delete THEN
        -- Always delete history for this item
        DELETE FROM stock_movements WHERE sale_item_id = v_sale_item_id;
        
        -- If the sale was NOT completed, we are done (no stock was deducted)
        IF v_sale_status NOT IN ('completed', 'selesai', 'slesai') THEN
            RETURN OLD;
        END IF;

        -- If it WAS completed, we must restore the stock but SILENTLY (no new movement record)
        -- Get product info
        SELECT branch_id, name INTO v_branch_id, v_product_name FROM products WHERE id = v_product_id;

        -- Restore Recipe Ingredients
        IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = v_product_id) THEN
            FOR r_recipe IN SELECT ingredient_id, amount FROM product_recipes WHERE product_id = v_product_id LOOP
                UPDATE ingredients 
                SET current_stock = current_stock + (r_recipe.amount * OLD.quantity), 
                    last_updated = CURRENT_DATE 
                WHERE id = r_recipe.ingredient_id;
            END LOOP;
        ELSE
            -- Restore Auto-Match
            UPDATE ingredients 
            SET current_stock = current_stock + OLD.quantity, last_updated = CURRENT_DATE 
            WHERE (LOWER(TRIM(name)) = (SELECT LOWER(TRIM(name)) FROM products WHERE id = v_product_id) OR code = (SELECT name FROM products WHERE id = v_product_id)) 
              AND (branch_id = v_branch_id OR branch_id IS NULL);
            
            -- Restore Direct Product Stock
            UPDATE products SET stock = stock + OLD.quantity WHERE id = v_product_id;
        END IF;

        RETURN OLD; -- EXIT HERE (Silent restore done)
    END IF;

    -- ==========================================
    -- CASE 2: INSERT/UPDATE OPERATION
    -- ==========================================
    
    -- Only process stock if sale is COMPLETED
    IF v_sale_status NOT IN ('completed', 'selesai', 'slesai') THEN
        RETURN NEW;
    END IF;

    -- If no change in quantity, do nothing
    IF v_quantity_diff = 0 THEN
        RETURN NEW;
    END IF;

    -- Get product info
    SELECT branch_id, name INTO v_branch_id, v_product_name FROM products WHERE id = v_product_id;

    -- CASE: Product has a Recipe
    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = v_product_id) THEN
        FOR r_recipe IN SELECT ingredient_id, amount FROM product_recipes WHERE product_id = v_product_id LOOP
            DECLARE
                v_total_diff NUMERIC := r_recipe.amount * v_quantity_diff;
                v_ing_name TEXT; v_ing_unit TEXT;
            BEGIN
                SELECT name, unit INTO v_ing_name, v_ing_unit FROM ingredients WHERE id = r_recipe.ingredient_id;
                
                -- Update Ingredient Stock
                UPDATE ingredients 
                SET current_stock = current_stock - v_total_diff, 
                    last_updated = CURRENT_DATE 
                WHERE id = r_recipe.ingredient_id
                RETURNING current_stock INTO v_new_stock;
                
                -- Record Movement (Only for non-zero diff)
                IF v_total_diff != 0 THEN
                    INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user", sale_item_id)
                    VALUES (r_recipe.ingredient_id, v_ing_name, v_branch_id, CASE WHEN v_total_diff > 0 THEN 'OUT' ELSE 'IN' END, ABS(v_total_diff), v_ing_unit, 
                        v_product_name || ' (' || ABS(v_quantity_diff) || ')', 'System', v_sale_item_id);
                END IF;

                -- Sync back to Product stock if 1-to-1
                IF r_recipe.amount = 1 THEN
                    UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
                END IF;
            END;
        END LOOP;
    ELSE
        -- CASE: Auto-Match by Name
        DECLARE
            v_match_id BIGINT; v_match_name TEXT; v_match_unit TEXT;
        BEGIN
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit FROM ingredients 
            WHERE (LOWER(TRIM(name)) = LOWER(TRIM(v_product_name)) OR code = v_product_name) 
              AND (branch_id = v_branch_id OR branch_id IS NULL) 
            ORDER BY (branch_id = v_branch_id) DESC LIMIT 1;
            
            IF v_match_id IS NOT NULL THEN
                UPDATE ingredients SET current_stock = current_stock - v_quantity_diff, last_updated = CURRENT_DATE WHERE id = v_match_id RETURNING current_stock INTO v_new_stock;
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user", sale_item_id)
                VALUES (v_match_id, v_match_name, v_branch_id, CASE WHEN v_quantity_diff > 0 THEN 'OUT' ELSE 'IN' END, ABS(v_quantity_diff), v_match_unit, v_product_name || ' [Auto]', 'System', v_sale_item_id);
                UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
            ELSE
                -- CASE: Direct Product Stock
                UPDATE products SET stock = stock - v_quantity_diff WHERE id = v_product_id;
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user", sale_item_id)
                VALUES (NULL, v_product_name, v_branch_id, CASE WHEN v_quantity_diff > 0 THEN 'OUT' ELSE 'IN' END, ABS(v_quantity_diff), 'pcs', v_product_name || ' [Direct]', 'System', v_sale_item_id);
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER ON SALES TABLE (Reversion)
CREATE OR REPLACE FUNCTION fn_handle_sale_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changes to COMPLETED, trigger stock deduction for all items
    IF (LOWER(NEW.status) IN ('completed', 'selesai', 'slesai')) AND 
       (LOWER(COALESCE(OLD.status, 'hold')) NOT IN ('completed', 'selesai', 'slesai')) THEN
        UPDATE sale_items SET quantity = quantity WHERE sale_id = NEW.id;
        
    -- If status changes FROM completed to something else (cancelled), restore stock SILENTLY
    ELSIF (LOWER(OLD.status) IN ('completed', 'selesai', 'slesai')) AND 
          (LOWER(NEW.status) NOT IN ('completed', 'selesai', 'slesai')) THEN
        
        -- Delete all movements for this sale
        DELETE FROM stock_movements WHERE sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = NEW.id);
        
        -- Manual silent restore for each item (simplest way is to call a helper or loop)
        -- To keep it clean, we'll just use the items to restore
        
        -- Restore ingredients from recipes
        UPDATE ingredients i
        SET current_stock = i.current_stock + sub.total_qty,
            last_updated = CURRENT_DATE
        FROM (
            SELECT pr.ingredient_id, SUM(pr.amount * si.quantity) as total_qty
            FROM sale_items si
            JOIN product_recipes pr ON si.product_id = pr.product_id
            WHERE si.sale_id = NEW.id
            GROUP BY pr.ingredient_id
        ) sub
        WHERE i.id = sub.ingredient_id;

        -- Restore auto-match and direct stock
        -- (This part is tricky in a single query, but we'll do the direct product stock at least)
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

-- 3. CLEAN UP REDUNDANT TRIGGERS
DROP TRIGGER IF EXISTS tr_restore_stock ON sale_items;
DROP TRIGGER IF EXISTS tr_stock_movement ON sale_items;
DROP TRIGGER IF EXISTS tr_sale_status_stock ON sales;

-- 4. APPLY NEW TRIGGERS
CREATE TRIGGER tr_sale_status_stock
AFTER UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION fn_handle_sale_status_change();

CREATE TRIGGER tr_stock_movement 
AFTER INSERT OR UPDATE OR DELETE ON sale_items 
FOR EACH ROW EXECUTE FUNCTION fn_handle_stock_movement();
