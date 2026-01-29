-- TEMUKAN DATA SAYA (FIND MY DATA)
-- Script ini akan membongkar semua tempat persembunyian data Anda.

SELECT '1. DAFTAR SEMUA CABANG YANG PUNYA TRANSAKSI' as info;
SELECT 
    b.id, 
    b.name, 
    COUNT(s.id) as jumlah_transaksi
FROM 
    branches b
JOIN 
    sales s ON s.branch_id = b.id
GROUP BY 
    b.id, b.name
ORDER BY 
    jumlah_transaksi DESC;

SELECT '2. DATA YANG TIDAK PUNYA CABANG (NULL)' as info;
SELECT COUNT(*) as jumlah_transaksi_tanpa_cabang FROM sales WHERE branch_id IS NULL;

SELECT '3. DATA DENGAN ID CABANG YANG SALAH (ORPHAN ID)' as info;
-- Data ini punya ID cabang, tapi cabangnya sudah dihapus/tidak ada di tabel branches
SELECT COUNT(*) as jumlah_transaksi_id_nyasar 
FROM sales s 
LEFT JOIN branches b ON s.branch_id = b.id 
WHERE b.id IS NULL AND s.branch_id IS NOT NULL;

-- Jika nomor 2 atau 3 ada isinya, kita bisa selamatkan.
-- Jika nomor 1 ada isinya tapi nama cabang aneh, kita bisa ganti namanya.
