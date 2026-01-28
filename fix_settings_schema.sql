-- Add theme_mode column to store_settings if it doesn't exist
alter table public.store_settings 
add column if not exists theme_mode text default 'light';

-- Add other potentially missing columns for completeness
alter table public.store_settings 
add column if not exists enable_email_notif boolean default true,
add column if not exists enable_push_notif boolean default true,
add column if not exists low_stock_alert boolean default true;
