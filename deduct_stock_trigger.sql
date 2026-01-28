-- Function to deduct stock based on sale items
CREATE OR REPLACE FUNCTION fn_deduct_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    r_recipe RECORD;
    v_product_name TEXT;
BEGIN
    -- Get product name for logging (optional, but good for history)
    SELECT name INTO v_product_name FROM products WHERE id = NEW.product_id;

    -- 1. Check if product has a recipe (Composite Product)
    IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = NEW.product_id) THEN
        
        -- Loop through all ingredients in the recipe
        FOR r_recipe IN 
            SELECT ingredient_id, amount 
            FROM product_recipes 
            WHERE product_id = NEW.product_id
        LOOP
            -- Calculate total amount to deduct (Recipe Amount * Sale Quantity)
            DECLARE
                v_deduct_amount NUMERIC := r_recipe.amount * NEW.quantity;
                v_ingredient_name TEXT;
                v_ingredient_unit TEXT;
            BEGIN
                -- Get ingredient details for logging
                SELECT name, unit INTO v_ingredient_name, v_ingredient_unit 
                FROM ingredients WHERE id = r_recipe.ingredient_id;

                -- Deduct from Ingredients Table
                UPDATE ingredients 
                SET current_stock = current_stock - v_deduct_amount,
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
                    'OUT',
                    v_deduct_amount,
                    v_ingredient_unit,
                    'Sold: ' || v_product_name || ' (' || NEW.quantity || ')',
                    'System'
                );
            END;
        END LOOP;

    ELSE
        -- 2. No Recipe (Simple Product) -> Deduct directly from Product Stock
        UPDATE products
        SET stock = stock - NEW.quantity
        WHERE id = NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger
DROP TRIGGER IF EXISTS tr_deduct_stock ON sale_items;
CREATE TRIGGER tr_deduct_stock
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION fn_deduct_stock_on_sale();
