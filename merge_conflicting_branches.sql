-- MERGE CONFLICTING BRANCHES (AUTO-FIX)
-- Skrip ini akan:
-- 1. Mencari semua cabang dengan nama "Winny Cafe Pangeran Natakusuma".
-- 2. Memilih SATU cabang yang memiliki jumlah PENJUALAN terbanyak sebagai "Main Branch".
-- 3. Memindahkan semua data dari cabang duplikat (dan data yang branch_id-nya NULL) ke Main Branch.
-- 4. Menghapus cabang-cabang duplikat yang sudah kosong.

DO $$ 
DECLARE 
    target_name TEXT := 'Winny Cafe Pangeran Natakusuma';
    winner_id BIGINT;
    loser_id BIGINT;
    r RECORD;
    count_orphans INT;
BEGIN 
    -- 1. IDENTIFIKASI PEMENANG (Branch dengan penjualan terbanyak)
    -- Kita urutkan berdasarkan jumlah sales, lalu products, lalu ID terlama.
    SELECT b.id INTO winner_id
    FROM branches b
    LEFT JOIN sales s ON s.branch_id = b.id
    WHERE b.name ILIKE target_name
    GROUP BY b.id
    ORDER BY COUNT(s.id) DESC, COUNT(b.id) ASC
    LIMIT 1;

    IF winner_id IS NULL THEN
        RAISE NOTICE 'Tidak ditemukan cabang dengan nama %', target_name;
        RETURN;
    END IF;

    RAISE NOTICE 'Cabang UTAMA (Winner) terdeteksi: ID %', winner_id;

    -- 2. PINDAHKAN DATA DARI CABANG DUPLIKAT (LOSERS) KE PEMENANG
    FOR r IN (SELECT id FROM branches WHERE name ILIKE target_name AND id != winner_id) LOOP
        loser_id := r.id;
        RAISE NOTICE 'Memproses & Menggabungkan cabang duplikat (Loser): ID %', loser_id;

        -- Update tables (pindahkan kepemilikan data)
        UPDATE products SET branch_id = winner_id WHERE branch_id = loser_id;
        UPDATE ingredients SET branch_id = winner_id WHERE branch_id = loser_id;
        UPDATE tables SET branch_id = winner_id WHERE branch_id = loser_id;
        UPDATE employees SET branch_id = winner_id WHERE branch_id = loser_id;
        UPDATE sales SET branch_id = winner_id WHERE branch_id = loser_id;
        UPDATE purchases SET branch_id = winner_id WHERE branch_id = loser_id;
        UPDATE stock_movements SET branch_id = winner_id WHERE branch_id = loser_id;
        
        -- Hapus cabang duplikat karena datanya sudah kosong/dipindah
        DELETE FROM branches WHERE id = loser_id;
        RAISE NOTICE 'Cabang duplikat ID % telah dihapus.', loser_id;
    END LOOP;

    -- 3. PINDAHKAN DATA ORPHAN (YANG TIDAK PUNYA CABANG / NULL) KE PEMENANG
    -- Ini untuk menyelamatkan data yang tadi mungkin sempat terhapus induknya.
    UPDATE products SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE ingredients SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE tables SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE employees SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE sales SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE purchases SET branch_id = winner_id WHERE branch_id IS NULL;
    UPDATE stock_movements SET branch_id = winner_id WHERE branch_id IS NULL;

    RAISE NOTICE 'SELESAI! Semua data telah disatukan ke cabang ID %', winner_id;
END $$;
