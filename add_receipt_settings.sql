-- Add receipt settings columns
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS show_customer_name BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_customer_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receipt_logo_url TEXT;

-- Create storage bucket for logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipt-logos', 'receipt-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public access to logos
CREATE POLICY "Public Access Logs" ON storage.objects FOR SELECT USING (bucket_id = 'receipt-logos');
-- Policy to allow authenticated uploads (adjust as needed for your auth model)
CREATE POLICY "Authenticated Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipt-logos');
