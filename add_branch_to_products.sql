-- Add branch_id to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_branch_id ON public.products(branch_id);

-- Update existing products to assign to first branch (migration)
UPDATE public.products 
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.products.branch_id IS 'ID cabang tempat produk ini tersedia';
