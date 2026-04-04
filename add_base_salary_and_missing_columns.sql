-- Migration: Add missing columns to employees table for Payroll and Access Integration
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Add base_salary (Gaji Pokok)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS base_salary NUMERIC NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.employees.base_salary IS 'Gaji Pokok (Base Salary) for payroll calculation';

-- 2. Add pin (Kiosk Access)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '123456';
COMMENT ON COLUMN public.employees.pin IS '6-digit numeric PIN for Kiosk/ESS login';

-- 3. Add system_role (App Access)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT NULL;
COMMENT ON COLUMN public.employees.system_role IS 'Role for System Access (e.g. Admin, Cashier)';

-- 4. Add barcode (Attendance)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_employees_barcode ON public.employees(barcode);
COMMENT ON COLUMN public.employees.barcode IS 'Barcode/QR Code unique value for attendance';

-- 5. Add fingerprint_template (Biometric)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS fingerprint_template TEXT;
COMMENT ON COLUMN public.employees.fingerprint_template IS 'Base64 encoded FMD for Fingerprint Scanner';

-- Optional: Initialize PIN for existing employees if they don't have one
UPDATE public.employees 
SET pin = id::text 
WHERE pin IS NULL OR pin = '123456';

COMMIT;
