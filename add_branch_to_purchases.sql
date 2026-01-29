-- Add branch_id to purchases table
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_purchases_branch_id ON public.purchases(branch_id);

-- Update existing purchases to assign to first branch (migration)
UPDATE public.purchases 
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.purchases.branch_id IS 'ID cabang tempat pembelian ini dilakukan';
