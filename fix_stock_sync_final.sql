-- ==========================================
-- FINAL FIX FOR STOCK SYNCHRONIZATION
-- Focus: Fixing UUID vs BIGINT mismatch and ensuring correct branch-aware stock deduction
-- ==========================================

-- 1. DEDUCT STOCK FUNCTION
CREATE OR REPLACE FUNCTION fn_deduct_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    r_recipe RECORD;
    v_product_name TEXT;
    v_branch_id BIGINT; -- Changed from INTEGER to BIGINT to match schema
    v_new_stock NUMERIC;
BEGIN
    -- Get branch_id and product_name
    SELECT branch_id, name INTO v_branch_id, v_product_name FROM products WHERE id = NEW.product_id;

    -- FALLBACK: If product_id is missing or product not found, try to get branch from Sale and use product_name from Item
    IF v_branch_id IS NULL THEN
        SELECT branch_id INTO v_branch_id FROM sales WHERE id = NEW.sale_id;
    END IF;
    
    IF v_product_name IS NULL THEN
        v_product_name := NEW.product_name;
    END IF;

    -- CASE 1: Product has a Recipe (Composite Product)
    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = NEW.product_id) THEN
        FOR r_recipe IN 
            SELECT ingredient_id, amount 
            FROM product_recipes 
            WHERE product_id = NEW.product_id
        LOOP
            DECLARE
                v_deduct_amount NUMERIC := r_recipe.amount * NEW.quantity;
                v_ing_name TEXT; 
                v_ing_unit TEXT;
            BEGIN
                -- Get ingredient details
                SELECT name, unit INTO v_ing_name, v_ing_unit 
                FROM ingredients WHERE id = r_recipe.ingredient_id;
                
                -- Deduct from Ingredients Table
                UPDATE ingredients 
                SET current_stock = current_stock - v_deduct_amount,
                    last_updated = CURRENT_DATE
                WHERE id = r_recipe.ingredient_id
                RETURNING current_stock INTO v_new_stock;

                -- Log Movement
                INSERT INTO stock_movements (
                    ingredient_id, 
                    ingredient_name, 
                    branch_id,
                    type, 
                    quantity, 
                    unit, 
                    reason, 
                    "user"
                ) VALUES (
                    r_recipe.ingredient_id,
                    COALESCE(v_ing_name, v_product_name, 'Unknown Ingredient'),
                    v_branch_id,
                    'OUT',
                    v_deduct_amount,
                    COALESCE(v_ing_unit, 'pcs'),
                    'Sold: ' || v_product_name || ' (' || NEW.quantity || ')',
                    'System'
                );

                -- NEW: Global Portion Sync
                -- Update stock for ALL products that use this ingredient
                UPDATE products p
                SET stock = FLOOR(v_new_stock / pr.amount)
                FROM product_recipes pr
                WHERE pr.product_id = p.id 
                  AND pr.ingredient_id = r_recipe.ingredient_id
                  AND pr.amount > 0;
                  
                -- Fallback Name Match Sync
                UPDATE products 
                SET stock = v_new_stock 
                WHERE name ILIKE v_ing_name AND branch_id = v_branch_id;
            END;
        END LOOP;
    ELSE
        -- CASE 2: No Recipe -> Try Auto-Match by Name/Code
        DECLARE
            v_match_id BIGINT; -- CRITICAL FIX: Changed from UUID to BIGINT
            v_match_name TEXT;
            v_match_unit TEXT;
        BEGIN
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit
            FROM ingredients 
            WHERE (TRIM(name) ILIKE TRIM(v_product_name) OR TRIM(code) ILIKE TRIM(v_product_name))
              AND (branch_id = v_branch_id OR branch_id IS NULL)
            LIMIT 1;

            IF v_match_id IS NOT NULL THEN
                -- Deduct from Ingredients Table (Auto-Match)
                UPDATE ingredients 
                SET current_stock = current_stock - NEW.quantity,
                    last_updated = CURRENT_DATE
                WHERE id = v_match_id
                RETURNING current_stock INTO v_new_stock;

                -- Log Movement
                INSERT INTO stock_movements (
                    ingredient_id, 
                    ingredient_name, 
                    branch_id,
                    type, 
                    quantity, 
                    unit, 
                    reason, 
                    "user"
                ) VALUES (
                    v_match_id,
                    COALESCE(v_match_name, v_product_name, 'Unknown Ingredient'),
                    v_branch_id,
                    'OUT',
                    NEW.quantity,
                    COALESCE(v_match_unit, 'pcs'),
                    'Sold: ' || v_product_name || ' (' || NEW.quantity || ') [Auto-Match]',
                    'System'
                );

                -- Always sync back to the Product stock for auto-matches
                UPDATE products SET stock = v_new_stock WHERE id = NEW.product_id;
            ELSE
                -- CASE 3: No Recipe AND No Auto-Match -> Deduct directly from Product Stock
                UPDATE products
                SET stock = stock - NEW.quantity
                WHERE id = NEW.product_id;
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. RESTORE STOCK FUNCTION
CREATE OR REPLACE FUNCTION fn_restore_stock_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    r_recipe RECORD;
    v_product_name TEXT;
    v_branch_id BIGINT;
    v_new_stock NUMERIC;
BEGIN
    -- Get branch_id and product_name
    SELECT branch_id, name INTO v_branch_id, v_product_name FROM products WHERE id = OLD.product_id;

    -- FALLBACK: If product_id is missing or product not found, try to get branch from Sale and use product_name from Item
    IF v_branch_id IS NULL THEN
        SELECT branch_id INTO v_branch_id FROM sales WHERE id = OLD.sale_id;
    END IF;
    
    IF v_product_name IS NULL THEN
        v_product_name := OLD.product_name;
    END IF;

    -- CASE 1: Product has a Recipe
    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = OLD.product_id) THEN
        FOR r_recipe IN 
            SELECT ingredient_id, amount 
            FROM product_recipes 
            WHERE product_id = OLD.product_id
        LOOP
            DECLARE
                v_restore_amount NUMERIC := r_recipe.amount * OLD.quantity;
                v_ing_name TEXT; 
                v_ing_unit TEXT;
            BEGIN
                SELECT name, unit INTO v_ing_name, v_ing_unit 
                FROM ingredients WHERE id = r_recipe.ingredient_id;
                
                -- Restore stock
                UPDATE ingredients 
                SET current_stock = current_stock + v_restore_amount,
                    last_updated = CURRENT_DATE
                WHERE id = r_recipe.ingredient_id
                RETURNING current_stock INTO v_new_stock;

                -- Log Movement
                INSERT INTO stock_movements (
                    ingredient_id, 
                    ingredient_name, 
                    branch_id,
                    type, 
                    quantity, 
                    unit, 
                    reason, 
                    "user"
                ) VALUES (
                    r_recipe.ingredient_id,
                    COALESCE(v_ing_name, v_product_name, 'Unknown Ingredient'),
                    v_branch_id,
                    'IN',
                    v_restore_amount,
                    COALESCE(v_ing_unit, 'pcs'),
                    'Cancelled: ' || v_product_name || ' (' || OLD.quantity || ')',
                    'System'
                );

                -- NEW: Global Portion Sync
                -- Update stock for ALL products that use this ingredient
                UPDATE products p
                SET stock = FLOOR(v_new_stock / pr.amount)
                FROM product_recipes pr
                WHERE pr.product_id = p.id 
                  AND pr.ingredient_id = r_recipe.ingredient_id
                  AND pr.amount > 0;
                  
                -- Fallback Name Match Sync
                UPDATE products 
                SET stock = v_new_stock 
                WHERE name ILIKE v_ing_name AND branch_id = v_branch_id;
            END;
        END LOOP;
    ELSE
        -- CASE 2: Auto-Match
        DECLARE
            v_match_id BIGINT; -- CRITICAL FIX: Changed from UUID to BIGINT
            v_match_name TEXT;
            v_match_unit TEXT;
        BEGIN
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit
            FROM ingredients 
            WHERE (TRIM(name) ILIKE TRIM(v_product_name) OR TRIM(code) ILIKE TRIM(v_product_name))
              AND (branch_id = v_branch_id OR branch_id IS NULL)
            LIMIT 1;

            IF v_match_id IS NOT NULL THEN
                UPDATE ingredients 
                SET current_stock = current_stock + OLD.quantity,
                    last_updated = CURRENT_DATE
                WHERE id = v_match_id
                RETURNING current_stock INTO v_new_stock;

                INSERT INTO stock_movements (
                    ingredient_id, 
                    ingredient_name, 
                    branch_id,
                    type, 
                    quantity, 
                    unit, 
                    reason, 
                    "user"
                ) VALUES (
                    v_match_id,
                    COALESCE(v_match_name, v_product_name, 'Unknown Ingredient'),
                    v_branch_id,
                    'IN',
                    OLD.quantity,
                    COALESCE(v_match_unit, 'pcs'),
                    'Cancelled: ' || v_product_name || ' (' || OLD.quantity || ') [Auto-Match]',
                    'System'
                );

                UPDATE products SET stock = v_new_stock WHERE id = OLD.product_id;
            ELSE
                -- CASE 3: Direct Product Stock
                UPDATE products
                SET stock = stock + OLD.quantity
                WHERE id = OLD.product_id;
            END IF;
        END;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. RE-APPLY TRIGGERS
DROP TRIGGER IF EXISTS tr_deduct_stock ON sale_items;
CREATE TRIGGER tr_deduct_stock
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION fn_deduct_stock_on_sale();

DROP TRIGGER IF EXISTS tr_restore_stock ON sale_items;
CREATE TRIGGER tr_restore_stock
AFTER DELETE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION fn_restore_stock_on_delete();
