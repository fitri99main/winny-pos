-- verify_gm_tables.sql
SELECT b.id as branch_id, b.name as branch_name, t.number, t.status 
FROM branches b
LEFT JOIN tables t ON b.id = t.branch_id
WHERE b.name ILIKE '%Gajah Mada%';

-- Also list all branches just in case the name is different
SELECT id, name FROM branches;
