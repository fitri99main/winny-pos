-- Check Branch IDs
SELECT id, name FROM branches;

-- Check Product Branches
SELECT branch_id, COUNT(*) FROM products GROUP BY branch_id;

-- Check Table Branches
SELECT branch_id, COUNT(*) FROM tables GROUP BY branch_id;
