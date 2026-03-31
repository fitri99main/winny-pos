-- 1. TAMBAHKAN KOLOM system_role JIKA BELUM ADA
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'system_role') THEN 
        ALTER TABLE public.employees ADD COLUMN system_role TEXT;
    END IF;
END $$;

-- 2. BACKFILL: Set system_role berdasarkan position jika masih kosong
UPDATE public.employees 
SET system_role = position 
WHERE system_role IS NULL AND position IN ('Manager', 'Owner', 'Administrator', 'Admin', 'Supervisor');

-- 3. VERIFIKASI
-- SELECT name, position, system_role FROM public.employees;
