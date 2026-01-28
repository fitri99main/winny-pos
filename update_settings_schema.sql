-- Add missing columns to store_settings table
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS working_days TEXT[] DEFAULT ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
ADD COLUMN IF NOT EXISTS late_tolerance INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS enable_email_notif BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_push_notif BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS low_stock_alert BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'light';

-- Force data update for existing row
UPDATE public.store_settings 
SET 
  opening_time = '08:00',
  closing_time = '22:00',
  working_days = ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  late_tolerance = 15,
  enable_email_notif = true,
  enable_push_notif = true,
  low_stock_alert = true,
  theme_mode = 'light'
WHERE id = 1;
