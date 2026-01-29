-- Add branch_id to tables table
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tables_branch_id ON public.tables(branch_id);

-- Update existing tables to assign to first branch
UPDATE public.tables 
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.tables.branch_id IS 'ID cabang dimana meja berada';
