-- ==========================================
-- FIX STOCK TRIGGERS (V2 - WITH BRANCH_ID)
-- ==========================================

-- 1. DEDUCT STOCK FUNCTION
CREATE OR REPLACE FUNCTION fn_deduct_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    r_recipe RECORD;
    v_product_name TEXT;
    v_branch_id INTEGER;
BEGIN
    -- Get branch_id from the parent sale
    SELECT branch_id INTO v_branch_id FROM sales WHERE id = NEW.sale_id;
    -- Get product name
    SELECT name INTO v_product_name FROM products WHERE id = NEW.product_id;

    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = NEW.product_id) THEN
        FOR r_recipe IN SELECT ingredient_id, amount FROM product_recipes WHERE product_id = NEW.product_id LOOP
            DECLARE
                v_deduct_amount NUMERIC := r_recipe.amount * NEW.quantity;
                v_ing_name TEXT; v_ing_unit TEXT;
            BEGIN
                SELECT name, unit INTO v_ing_name, v_ing_unit FROM ingredients WHERE id = r_recipe.ingredient_id;
                UPDATE ingredients SET current_stock = current_stock - v_deduct_amount, last_updated = CURRENT_DATE WHERE id = r_recipe.ingredient_id;
                
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
                VALUES (r_recipe.ingredient_id, v_ing_name, v_branch_id, 'OUT', v_deduct_amount, v_ing_unit, 'Sold: ' || v_product_name || ' (' || NEW.quantity || ')', 'System');
            END;
        END LOOP;
    ELSE
        DECLARE
            v_match_id UUID; v_match_name TEXT; v_match_unit TEXT;
        BEGIN
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit FROM ingredients 
            WHERE (name = v_product_name OR code = v_product_name) AND (branch_id = v_branch_id OR branch_id IS NULL) LIMIT 1;
            
            IF v_match_id IS NOT NULL THEN
                UPDATE ingredients SET current_stock = current_stock - NEW.quantity, last_updated = CURRENT_DATE WHERE id = v_match_id;
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
                VALUES (v_match_id, v_match_name, v_branch_id, 'OUT', NEW.quantity, v_match_unit, 'Sold: ' || v_product_name || ' (' || NEW.quantity || ') [Auto]', 'System');
            ELSE
                UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
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
    v_branch_id INTEGER;
BEGIN
    -- Get branch_id from the parent sale
    SELECT branch_id INTO v_branch_id FROM sales WHERE id = OLD.sale_id;
    -- Get product name
    SELECT name INTO v_product_name FROM products WHERE id = OLD.product_id;

    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = OLD.product_id) THEN
        FOR r_recipe IN SELECT ingredient_id, amount FROM product_recipes WHERE product_id = OLD.product_id LOOP
            DECLARE
                v_restore_amount NUMERIC := r_recipe.amount * OLD.quantity;
                v_ing_name TEXT; v_ing_unit TEXT;
            BEGIN
                SELECT name, unit INTO v_ing_name, v_ing_unit FROM ingredients WHERE id = r_recipe.ingredient_id;
                UPDATE ingredients SET current_stock = current_stock + v_restore_amount, last_updated = CURRENT_DATE WHERE id = r_recipe.ingredient_id;
                
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
                VALUES (r_recipe.ingredient_id, v_ing_name, v_branch_id, 'IN', v_restore_amount, v_ing_unit, 'Restored: ' || v_product_name || ' (' || OLD.quantity || ')', 'System');
            END;
        END LOOP;
    ELSE
        DECLARE
            v_match_id UUID; v_match_name TEXT; v_match_unit TEXT;
        BEGIN
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit FROM ingredients 
            WHERE (name = v_product_name OR code = v_product_name) AND (branch_id = v_branch_id OR branch_id IS NULL) LIMIT 1;
            
            IF v_match_id IS NOT NULL THEN
                UPDATE ingredients SET current_stock = current_stock + OLD.quantity, last_updated = CURRENT_DATE WHERE id = v_match_id;
                INSERT INTO stock_movements (ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason, "user")
                VALUES (v_match_id, v_match_name, v_branch_id, 'IN', OLD.quantity, v_match_unit, 'Restored: ' || v_product_name || ' (' || OLD.quantity || ') [Auto]', 'System');
            ELSE
                UPDATE products SET stock = stock + OLD.quantity WHERE id = OLD.product_id;
            END IF;
        END;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. APPLY TRIGGERS
DROP TRIGGER IF EXISTS tr_deduct_stock ON sale_items;
CREATE TRIGGER tr_deduct_stock AFTER INSERT ON sale_items FOR EACH ROW EXECUTE FUNCTION fn_deduct_stock_on_sale();

DROP TRIGGER IF EXISTS tr_restore_stock ON sale_items;
CREATE TRIGGER tr_restore_stock AFTER DELETE ON sale_items FOR EACH ROW EXECUTE FUNCTION fn_restore_stock_on_delete();
