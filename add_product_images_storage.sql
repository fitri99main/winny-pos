-- Create storage bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read access to product images
CREATE POLICY "Public Read Product Images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- Policy to allow authenticated uploads to product images
CREATE POLICY "Authenticated Upload Product Images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');

-- Policy to allow authenticated deletions to product images
CREATE POLICY "Authenticated Delete Product Images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images');
