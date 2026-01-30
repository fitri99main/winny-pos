-- Add 'target' column to 'products' table to specify KDS destination
-- Default is 'Kitchen' (Dapur), other option is 'Bar'

ALTER TABLE products 
ADD COLUMN target text DEFAULT 'Kitchen';

-- Optional: Update existing beverages to Bar (heuristic)
UPDATE products 
SET target = 'Bar' 
WHERE name ILIKE '%kopi%' OR name ILIKE '%teh%' OR name ILIKE '%jus%' OR name ILIKE '%ice%' OR category ILIKE '%minuman%';
