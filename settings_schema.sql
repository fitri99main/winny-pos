-- Create store_settings table (Singleton)
CREATE TABLE IF NOT EXISTS public.store_settings (
    id BIGINT PRIMARY KEY DEFAULT 1, -- Force singleton ID 1
    store_name TEXT DEFAULT 'WinPOS Store',
    address TEXT DEFAULT 'Jl. Contoh No. 123',
    phone TEXT DEFAULT '+6281234567890',
    receipt_header TEXT DEFAULT 'WINNY CAFE',
    receipt_footer TEXT DEFAULT 'Terima Kasih, Datang Lagi!',
    receipt_paper_width TEXT DEFAULT '58mm', -- 58mm or 80mm
    show_date BOOLEAN DEFAULT true,
    show_waiter BOOLEAN DEFAULT true,
    show_table BOOLEAN DEFAULT true,
    tax_rate NUMERIC DEFAULT 11.0,
    service_charge_rate NUMERIC DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Enable all for users based on email" ON public.store_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;

-- Seed Initial Settings
INSERT INTO public.store_settings (id, store_name, receipt_header) 
VALUES (1, 'WinPOS Main Branch', 'WINNY CAFE')
ON CONFLICT (id) DO NOTHING;
