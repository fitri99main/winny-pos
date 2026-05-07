-- Clean up 'unit' string from ingredients and stock_movements
-- and replace with actual units from master data if possible, or default to 'pcs'

-- 1. Update ingredients that have 'unit'
UPDATE ingredients 
SET unit = 'pcs' 
WHERE unit = 'unit' OR unit IS NULL OR unit = '';

-- 2. Update stock_movements that have 'unit'
-- Match with the actual unit from the ingredients table
UPDATE stock_movements sm
SET unit = i.unit
FROM ingredients i
WHERE sm.ingredient_id = i.id
AND (sm.unit = 'unit' OR sm.unit IS NULL OR sm.unit = '');

-- 3. Any remaining stock_movements with 'unit' (e.g. if ingredient was deleted)
UPDATE stock_movements
SET unit = 'pcs'
WHERE unit = 'unit' OR unit IS NULL OR unit = '';
