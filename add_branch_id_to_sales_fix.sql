-- FIX: Ensure branch_id exists on sales table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'branch_id') THEN
        ALTER TABLE public.sales ADD COLUMN branch_id INTEGER;
        RAISE NOTICE 'Added branch_id column to sales';
    END IF;
END $$;
