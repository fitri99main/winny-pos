-- Add cashier permission settings to store_settings
-- This allows manual control over whether cashier accounts can view reports and session history

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS cashier_can_view_reports BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cashier_can_view_session_history BOOLEAN DEFAULT FALSE;

-- Ensure existing record (ID=1) has these columns set
UPDATE public.store_settings 
SET 
    cashier_can_view_reports = COALESCE(cashier_can_view_reports, FALSE),
    cashier_can_view_session_history = COALESCE(cashier_can_view_session_history, FALSE)
WHERE id = 1;

COMMENT ON COLUMN public.store_settings.cashier_can_view_reports IS 'Whether cashier role can view sales reports on mobile app';
COMMENT ON COLUMN public.store_settings.cashier_can_view_session_history IS 'Whether cashier role can view cashier session history on mobile app';
