-- CEK DATA "YANG HILANG" (ORPHANED DATA)
-- Jika cabang dihapus, data biasanya tidak hilang permanen, tapi menjadi netral (branch_id = NULL).
-- Script ini menghitung berapa banyak data yang statusnya "mengambang" tanpa cabang.

SELECT 
    (SELECT COUNT(*) FROM sales WHERE branch_id IS NULL) as penjualan_tanpa_cabang,
    (SELECT COUNT(*) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE branch_id IS NULL)) as item_terjual_tanpa_cabang,
    (SELECT COUNT(*) FROM products WHERE branch_id IS NULL) as produk_tanpa_cabang,
    (SELECT COUNT(*) FROM employees WHERE branch_id IS NULL) as karyawan_tanpa_cabang,
    (SELECT COUNT(*) FROM stock_movements WHERE branch_id IS NULL) as riwayat_stok_tanpa_cabang;

-- Jika angkanya BANYAK (lebih dari 0), BERARTI DATA ANDA AMAN!
-- Kita hanya perlu menjalankan script "fix_products_branch.sql" lagi untuk menariknya kembali.
