-- Function to restore stock when a sale item is deleted
CREATE OR REPLACE FUNCTION fn_restore_stock_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    r_recipe RECORD;
    v_product_name TEXT;
BEGIN
    -- Get product name for logging
    SELECT name INTO v_product_name FROM products WHERE id = OLD.product_id;

    -- 1. Check if product has a recipe (Composite Product)
    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = OLD.product_id) THEN
        FOR r_recipe IN 
            SELECT ingredient_id, amount 
            FROM product_recipes 
            WHERE product_id = OLD.product_id
        LOOP
            DECLARE
                v_restore_amount NUMERIC := r_recipe.amount * OLD.quantity;
                v_ingredient_name TEXT;
                v_ingredient_unit TEXT;
            BEGIN
                -- Get ingredient details for logging
                SELECT name, unit INTO v_ingredient_name, v_ingredient_unit 
                FROM ingredients WHERE id = r_recipe.ingredient_id;

                -- Restore to Ingredients Table
                UPDATE ingredients 
                SET current_stock = current_stock + v_restore_amount,
                    last_updated = CURRENT_DATE
                WHERE id = r_recipe.ingredient_id;

                -- Log Movement
                INSERT INTO stock_movements (
                    ingredient_id, 
                    ingredient_name, 
                    type, 
                    quantity, 
                    unit, 
                    reason, 
                    "user"
                ) VALUES (
                    r_recipe.ingredient_id,
                    v_ingredient_name,
                    'IN',
                    v_restore_amount,
                    v_ingredient_unit,
                    'Restored (Delete/Update): ' || v_product_name || ' (' || OLD.quantity || ')',
                    'System'
                );
            END;
        END LOOP;
    ELSE
        -- 2. No Recipe -> Try Auto-Match with Ingredients Table by Name
        DECLARE
            v_match_id UUID;
            v_match_name TEXT;
            v_match_unit TEXT;
        BEGIN
            SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit
            FROM ingredients 
            WHERE name = v_product_name OR code = v_product_name
            LIMIT 1;

            IF v_match_id IS NOT NULL THEN
                -- Restore to Ingredients Table (Auto-Match)
                UPDATE ingredients 
                SET current_stock = current_stock + OLD.quantity,
                    last_updated = CURRENT_DATE
                WHERE id = v_match_id;

                -- Log Movement
                INSERT INTO stock_movements (
                    ingredient_id, 
                    ingredient_name, 
                    type, 
                    quantity, 
                    unit, 
                    reason, 
                    "user"
                ) VALUES (
                    v_match_id,
                    v_match_name,
                    'IN',
                    OLD.quantity,
                    v_match_unit,
                    'Restored (Delete/Update): ' || v_product_name || ' (' || OLD.quantity || ') [Auto-Match]',
                    'System'
                );
            ELSE
                -- 3. No Recipe AND No Auto-Match -> Restore directly to Product Stock
                UPDATE products
                SET stock = stock + OLD.quantity
                WHERE id = OLD.product_id;
            END IF;
        END;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger for Restore
DROP TRIGGER IF EXISTS tr_restore_stock ON sale_items;
CREATE TRIGGER tr_restore_stock
AFTER DELETE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION fn_restore_stock_on_delete();
