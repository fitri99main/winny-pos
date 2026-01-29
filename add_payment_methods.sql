-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'digital', -- 'cash', 'digital', 'card'
    is_active BOOLEAN DEFAULT true,
    is_static BOOLEAN DEFAULT false, -- If true, prevent deletion
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Allow public read (or authenticated depending on setup, but typically everyone needs to see methods)
CREATE POLICY "Allow public read on payment_methods" ON payment_methods FOR SELECT USING (true);
CREATE POLICY "Allow all on payment_methods for authenticated" ON payment_methods FOR ALL USING (auth.role() = 'authenticated');

-- Seed initial data
INSERT INTO payment_methods (name, type, is_active, is_static) VALUES 
('Tunai', 'cash', true, true),
('Kartu Debit/Kredit', 'card', true, true),
('QRIS', 'digital', true, true),
('GOJEK', 'digital', true, true),
('GRAB', 'digital', true, true)
ON CONFLICT (name) DO NOTHING;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE payment_methods;
