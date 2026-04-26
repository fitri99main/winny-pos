-- Lari ini di Supabase SQL Editor untuk memperbaiki 'channel_error'
-- Realtime membutuhkan tabel untuk masuk ke publikasi 'supabase_realtime'

-- 1. Cek apakah publikasi sudah ada, jika belum buat (jarang terjadi)
-- CREATE PUBLICATION supabase_realtime;

-- 2. Tambahkan tabel 'sales' ke publikasi realtime
-- Jika sudah ada akan muncul error 'already exists', abaikan saja.
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- 3. Tambahkan tabel lainnya jika diperlukan
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cashier_sessions;

-- 4. Pastikan Row Level Security (RLS) mengizinkan akses 'select'
-- Tanpa 'select' access, realtime juga bisa gagal.
-- ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow realtime select" ON public.sales FOR SELECT USING (true);
