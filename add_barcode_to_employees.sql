-- Add barcode column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_employees_barcode ON public.employees(barcode);

-- Comment
COMMENT ON COLUMN public.employees.barcode IS 'Barcode/QR Code unique value for attendance';
