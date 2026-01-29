-- ANALISIS DUPLICATE BRANCHES
-- Skrip ini akan menampilkan semua cabang dengan nama yang mirip dan jumlah data di dalamnya.

SELECT 
    b.id, 
    b.name, 
    b.created_at,
    (SELECT COUNT(*) FROM products p WHERE p.branch_id = b.id) as total_products,
    (SELECT COUNT(*) FROM sales s WHERE s.branch_id = b.id) as total_sales,
    (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id) as total_employees,
    (SELECT COUNT(*) FROM stock_movements sm WHERE sm.branch_id = b.id) as total_stock_history
FROM 
    branches b
WHERE 
    b.name ILIKE '%Winny Cafe Pangeran Natakusuma%'
ORDER BY 
    total_sales DESC, total_products DESC;
