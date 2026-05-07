-- ==========================================
-- FIX STOCK TRIGGERS (V4 - COMPREHENSIVE)
-- Handles INSERT, UPDATE, DELETE and Case-Insensitive Matching
-- ==========================================

-- 1. UNIFIED STOCK HANDLER FUNCTION
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
BEGIN
    -- Determine which record to use and the quantity change
    IF v_is_delete THEN
        v_product_id := OLD.product_id;
        v_quantity_diff := -OLD.quantity; -- Negative deduction = restore
    ELSIF v_is_insert THEN
        v_product_id := NEW.product_id;
        v_quantity_diff := NEW.quantity; -- Positive deduction
    ELSIF v_is_update THEN
        v_product_id := NEW.product_id;
        v_quantity_diff := NEW.quantity - OLD.quantity;
    END IF;

    -- If no change in quantity, do nothing
    IF v_quantity_diff = 0 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Get product info
    SELECT branch_id, name INTO v_branch_id, v_product_name FROM products WHERE id = v_product_id;

    -- CASE 1: Product has a Recipe
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
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
                VALUES (r_recipe.ingredient_id, v_ing_name, v_branch_id, v_move_type, ABS(v_total_diff), v_ing_unit, 
                    (CASE WHEN v_is_update THEN 'Update Order' WHEN v_is_delete THEN 'Delete Order' ELSE 'Sale' END) || ': ' || v_product_name || ' (' || ABS(v_quantity_diff) || ')', 'System');

                -- [SYNC] If 1-to-1 relationship, sync back to Product stock column
                IF r_recipe.amount = 1 THEN
                    UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
                END IF;
            END;
        END LOOP;
    ELSE
        -- CASE 2: No Recipe -> Try Auto-Match by Name (Case-Insensitive)
        DECLARE
            v_match_id BIGINT; v_match_name TEXT; v_match_unit TEXT;
            v_move_type TEXT;
        BEGIN
            -- Using LOWER() and TRIM() for robust matching
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit FROM ingredients 
            WHERE (LOWER(TRIM(name)) = LOWER(TRIM(v_product_name)) OR code = v_product_name) 
              AND (branch_id = v_branch_id OR branch_id IS NULL) 
            ORDER BY (branch_id = v_branch_id) DESC -- Prefer exact branch match
            LIMIT 1;
            
            v_move_type := CASE WHEN v_quantity_diff > 0 THEN 'OUT' ELSE 'IN' END;

            IF v_match_id IS NOT NULL THEN
                -- Update Ingredient Stock
                UPDATE ingredients 
                SET current_stock = current_stock - v_quantity_diff, 
                    last_updated = CURRENT_DATE 
                WHERE id = v_match_id
                RETURNING current_stock INTO v_new_stock;

                -- Record Movement
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
                VALUES (v_match_id, v_match_name, v_branch_id, v_move_type, ABS(v_quantity_diff), v_match_unit, 
                    (CASE WHEN v_is_update THEN 'Update Order' WHEN v_is_delete THEN 'Delete Order' ELSE 'Sale' END) || ': ' || v_product_name || ' (' || ABS(v_quantity_diff) || ') [Auto]', 'System');

                -- [SYNC] Always sync back to the Product stock for auto-matches
                UPDATE products SET stock = v_new_stock WHERE id = v_product_id;
            ELSE
                -- CASE 3: Deduct directly from Product Stock (No Match)
                UPDATE products SET stock = stock - v_quantity_diff WHERE id = v_product_id;
                
                -- [NEW] Even if no matching ingredient, log the movement for the Stock Card
                -- We use NULL ingredient_id but provide the product name
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
                VALUES (NULL, v_product_name, v_branch_id, v_move_type, ABS(v_quantity_diff), 'pcs', 
                    (CASE WHEN v_is_update THEN 'Update Order' WHEN v_is_delete THEN 'Delete Order' ELSE 'Sale' END) || ': ' || v_product_name || ' (' || ABS(v_quantity_diff) || ') [Direct]', 'System');
            END IF;
        END;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. APPLY TRIGGERS
DROP TRIGGER IF EXISTS tr_stock_movement ON sale_items;
CREATE TRIGGER tr_stock_movement 
AFTER INSERT OR UPDATE OR DELETE ON sale_items 
FOR EACH ROW EXECUTE FUNCTION fn_handle_stock_movement();

-- 3. CLEAN UP OLD TRIGGERS (if any)
DROP TRIGGER IF EXISTS tr_deduct_stock ON sale_items;
DROP TRIGGER IF EXISTS tr_restore_stock ON sale_items;
