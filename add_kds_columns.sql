-- Run this in Supabase SQL Editor to enable KDS functionality

-- 1. Add missing columns to 'sales' table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS waiting_time text;

-- 2. Add missing columns to 'sale_items' table
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS target text DEFAULT 'Kitchen';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS is_taxed boolean DEFAULT false;

-- 3. Update existing data if necessary
UPDATE public.sale_items SET status = 'Pending' WHERE status IS NULL;
UPDATE public.sale_items SET target = 'Kitchen' WHERE target IS NULL;

-- 4. Ensure RLS allows item status updates
-- (Waiters/Cashiers need to update item status)
CREATE POLICY "Enable update for auth users" ON public.sale_items 
FOR UPDATE USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');
