-- Add enable_table_management column to store_settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS enable_table_management BOOLEAN DEFAULT true;
