-- Add separate settings for Kitchen and Bar tickets
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS kitchen_header TEXT DEFAULT 'DAPUR',
ADD COLUMN IF NOT EXISTS kitchen_footer TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS kitchen_show_table BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kitchen_show_waiter BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kitchen_show_date BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kitchen_show_cashier BOOLEAN DEFAULT true,

ADD COLUMN IF NOT EXISTS bar_header TEXT DEFAULT 'BAR',
ADD COLUMN IF NOT EXISTS bar_footer TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS bar_show_table BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bar_show_waiter BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bar_show_date BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bar_show_cashier BOOLEAN DEFAULT true;

-- Update existing row with defaults
UPDATE public.store_settings 
SET 
  kitchen_header = COALESCE(kitchen_header, 'DAPUR'),
  kitchen_show_table = COALESCE(kitchen_show_table, true),
  kitchen_show_waiter = COALESCE(kitchen_show_waiter, true),
  kitchen_show_date = COALESCE(kitchen_show_date, true),
  kitchen_show_cashier = COALESCE(kitchen_show_cashier, true),
  bar_header = COALESCE(bar_header, 'BAR'),
  bar_show_table = COALESCE(bar_show_table, true),
  bar_show_waiter = COALESCE(bar_show_waiter, true),
  bar_show_date = COALESCE(bar_show_date, true),
  bar_show_cashier = COALESCE(bar_show_cashier, true)
WHERE id = 1;
