-- Add branch_id to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON public.employees(branch_id);

-- Update existing employees to assign to first branch (migration)
UPDATE public.employees 
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.employees.branch_id IS 'ID cabang tempat karyawan bekerja';
