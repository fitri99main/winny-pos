-- Mengecek apakah tabel 'sales' sudah masuk ke publikasi realtime
SELECT 
    schemaname, 
    tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'sales';

-- Jika hasil kosong, jalankan ini:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
