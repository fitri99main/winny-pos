-- Add PIN column to Employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS pin text;

-- Optional: Set default PIN to ID for existing users (so they aren't locked out)
-- This logic assumes ID is a number. If ID is text, just use ID.
UPDATE public.employees 
SET pin = id::text 
WHERE pin IS NULL;

-- Comment on column
COMMENT ON COLUMN public.employees.pin IS '6-digit numeric PIN for Kiosk/ESS login';
