-- CHECK DATA SCRIPT
-- Jalankan ini untuk melihat APAKAH data produk sudah masuk ke cabang yang benar

-- 1. Lihat Daftar Cabang
SELECT id, name FROM public.branches;

-- 2. Hitung jumlah produk per Cabang
SELECT 
    b.name as branch_name, 
    p.branch_id, 
    COUNT(p.id) as product_count
FROM public.products p
LEFT JOIN public.branches b ON p.branch_id = b.id
GROUP BY b.name, p.branch_id;

-- 3. Lihat Produk yang MASIH NULL (Belum punya cabang)
SELECT COUNT(*) as unassigned_products FROM public.products WHERE branch_id IS NULL;

-- 4. Sample 5 Produk di Cabang 'Pangeran Natakusuma'
SELECT id, name, branch_id FROM public.products 
WHERE branch_id IN (SELECT id FROM public.branches WHERE name ILIKE '%Pangeran Natakusuma%')
LIMIT 5;
