-- seed_tables_gajahmada.sql
DO $$ 
DECLARE 
    target_branch_id UUID;
BEGIN
    -- Find the branch ID for Gajah Mada (assuming name contains 'Gajah Mada' or similar)
    SELECT id INTO target_branch_id FROM branches WHERE name ILIKE '%Gajah Mada%' LIMIT 1;

    IF target_branch_id IS NOT NULL THEN
        -- Insert Tables if they don't exist
        INSERT INTO tables (number, capacity, branch_id, status)
        VALUES 
            ('GM-01', 4, target_branch_id, 'Empty'),
            ('GM-02', 2, target_branch_id, 'Empty'),
            ('GM-03', 4, target_branch_id, 'Empty'),
            ('GM-04', 6, target_branch_id, 'Empty'),
            ('GM-05', 4, target_branch_id, 'Empty')
        ON CONFLICT (number, branch_id) DO NOTHING;
    END IF;
END $$;
