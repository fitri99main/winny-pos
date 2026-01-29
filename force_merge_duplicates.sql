-- FORCE MERGE DUPLICATES (SOLUSI TUNTAS)
-- Skrip ini dirancang untuk menyatukan semua data yang terpecah ke dalam SATU cabang utama.

DO $$ 
DECLARE 
    target_name TEXT := 'Winny Cafe Pangeran Natakusuma';
    winner_id BIGINT;
    ghost_count INT;
    orphan_count INT;
    duplicate_count INT;
BEGIN 
    RAISE NOTICE '--- MEMULAI PROSES PENYATUAN DATA ---';

    -- 1. TENTUKAN PEMENANG (Branch Aktif dengan nama sesuai dan penjualan terbanyak)
    SELECT b.id INTO winner_id
    FROM branches b
    LEFT JOIN sales s ON s.branch_id = b.id
    WHERE b.name ILIKE target_name
    GROUP BY b.id
    ORDER BY COUNT(s.id) DESC, b.created_at ASC
    LIMIT 1;

    -- Jika tidak ada cabang sama sekali, buat baru.
    IF winner_id IS NULL THEN
        INSERT INTO public.branches (name, address, phone, status)
        VALUES (target_name, 'Jl. Pangeran Natakusuma', '-', 'Active')
        RETURNING id INTO winner_id;
        RAISE NOTICE 'Cabang baru dibuat (karena tidak ditemukan) dengan ID: %', winner_id;
    ELSE
        RAISE NOTICE 'Cabang UTAMA ditemukan: ID %', winner_id;
    END IF;

    -- 2. SELAMATKAN DATA "HANTU" (Referencing ID yang sudah tidak ada di tabel branches)
    -- Ini terjadi jika cabang dihapus tapi datanya masih menunjuk ke ID lama.
    WITH ghost_rows AS (
        UPDATE sales 
        SET branch_id = winner_id 
        WHERE branch_id IS NOT NULL AND branch_id NOT IN (SELECT id FROM branches)
        RETURNING id
    )
    SELECT COUNT(*) INTO ghost_count FROM ghost_rows;
    RAISE NOTICE 'Dipulihkan % transaksi dari ID cabang yang sudah dihapus/hilang.', ghost_count;

    -- Lakukan juga untuk tabel lain (Ghost cleanup)
    UPDATE products SET branch_id = winner_id WHERE branch_id NOT IN (SELECT id FROM branches);
    UPDATE tables SET branch_id = winner_id WHERE branch_id NOT IN (SELECT id FROM branches);
    UPDATE employees SET branch_id = winner_id WHERE branch_id NOT IN (SELECT id FROM branches);
    UPDATE stock_movements SET branch_id = winner_id WHERE branch_id NOT IN (SELECT id FROM branches);

    -- 3. SELAMATKAN DATA "YATIM PIATU" (Branch ID = NULL)
    WITH orphan_rows AS (
        UPDATE sales 
        SET branch_id = winner_id 
        WHERE branch_id IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO orphan_count FROM orphan_rows;
    RAISE NOTICE 'Dipulihkan % transaksi yang tidak punya cabang (NULL).', orphan_count;

    -- Lakukan juga untuk tabel lain (Orphan cleanup)
    UPDATE products SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE tables SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE employees SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE stock_movements SET branch_id = winner_id WHERE branch_id IS NULL;

    -- 4. GABUNGKAN DATA DARI CABANG DUPLIKAT (Jika ada cabang lain dengan nama mirip)
    -- Kita pindahkan isinya ke winner, lalu hapus cabangnya.
    UPDATE sales SET branch_id = winner_id WHERE branch_id != winner_id AND branch_id IN (SELECT id FROM branches WHERE name ILIKE target_name);
    UPDATE products SET branch_id = winner_id WHERE branch_id != winner_id AND branch_id IN (SELECT id FROM branches WHERE name ILIKE target_name);
    
    -- Hapus cabang duplikat yang sekarang sudah kosong
    DELETE FROM branches 
    WHERE id != winner_id AND name ILIKE target_name;
    
    RAISE NOTICE 'Data dari cabang duplikat telah digabung dan cabang duplikat dihapus.';

    RAISE NOTICE '--- SELESAI ---';
    RAISE NOTICE 'Semua data sekarang aman di cabang ID: % (%)', winner_id, target_name;
END $$;
