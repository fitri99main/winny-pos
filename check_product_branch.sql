-- Check products and their branch_id
SELECT 
    id,
    name,
    price,
    branch_id,
    CASE 
        WHEN branch_id IS NULL THEN 'NULL (tidak ada cabang)'
        WHEN branch_id = 7 THEN 'Pangeran Natakusuma ✓'
        ELSE 'Cabang lain'
    END as status_cabang
FROM products
ORDER BY branch_id, name;

-- Count products by branch
SELECT 
    branch_id,
    b.name as branch_name,
    COUNT(*) as total_products
FROM products p
LEFT JOIN branches b ON p.branch_id = b.id
GROUP BY branch_id, b.name
ORDER BY branch_id;

-- Check if branch 7 exists
SELECT id, name, address, status 
FROM branches 
WHERE id = 7 OR name ILIKE '%Pangeran Natakusuma%';

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
