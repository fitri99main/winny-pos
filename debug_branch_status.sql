-- DEBUG BRANCH STATUS
-- Cek di mana data Anda sebenarnya berada.

SELECT '--- CABANG AKTIF ---' as info;
SELECT 
    id, 
    name, 
    (SELECT COUNT(*) FROM products WHERE branch_id = branches.id) as produk,
    (SELECT COUNT(*) FROM sales WHERE branch_id = branches.id) as penjualan
FROM branches;

SELECT '--- DATA TANPA CABANG (ORPHAN) ---' as info;
SELECT 
    (SELECT COUNT(*) FROM products WHERE branch_id IS NULL) as produk_orphan,
    (SELECT COUNT(*) FROM sales WHERE branch_id IS NULL) as penjualan_orphan;

-- Jika "penjualan" ada di salah satu ID cabang di atas, berarti data aman.
-- Masalahnya mungkin hanya di Aplikasi (perlu Re-Select cabang).
