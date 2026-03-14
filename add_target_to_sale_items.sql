-- Add target column to sale_items table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS target text;

-- Update existing items using the same heuristic used in the UI temporarily
UPDATE public.sale_items si
SET target = CASE 
    WHEN (LOWER(si.product_name) LIKE '%kopi%' OR 
          LOWER(si.product_name) LIKE '%teh%' OR 
          LOWER(si.product_name) LIKE '%jus%' OR 
          LOWER(si.product_name) LIKE '%ice%' OR 
          LOWER(si.product_name) LIKE '%panas%' OR 
          LOWER(si.product_name) LIKE '%dingin%' OR 
          LOWER(si.product_name) LIKE '%drink%' OR 
          LOWER(si.product_name) LIKE '%minum%') THEN 'Bar'
    ELSE 'Kitchen'
END
WHERE target IS NULL;
