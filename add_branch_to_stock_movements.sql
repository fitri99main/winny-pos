-- Add branch_id to stock_movements table
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_id ON public.stock_movements(branch_id);

-- Update existing movements to assign to first branch
-- Fallback strategy: Assign all existing movements to the first available branch
UPDATE public.stock_movements 
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.stock_movements.branch_id IS 'ID cabang tempat pergerakan stok terjadi';
