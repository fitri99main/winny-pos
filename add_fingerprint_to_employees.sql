-- Migration: Add fingerprint_template to employees
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS fingerprint_template TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.employees.fingerprint_template IS 'Base64 encoded FMD (Fingerprint Minutiae Data) for DigitalPersona/ZKTeco 4500 USB.';
