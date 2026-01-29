-- Add branch_id to ingredients table
ALTER TABLE public.ingredients 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ingredients_branch_id ON public.ingredients(branch_id);

-- Update existing ingredients to assign to first branch (migration)
UPDATE public.ingredients 
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.ingredients.branch_id IS 'ID cabang tempat bahan baku ini dikelola';
