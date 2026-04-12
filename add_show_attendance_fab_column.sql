-- Add show_attendance_fab column to store_settings table
-- This allows toggling the floating attendance button from the settings menu

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS show_attendance_fab BOOLEAN DEFAULT true;

-- Update schema cache (Supabase specific, happens automatically but good to mention)
COMMENT ON COLUMN public.store_settings.show_attendance_fab IS 'Toggles the visibility of the floating quick-attendance button on the dashboard';
