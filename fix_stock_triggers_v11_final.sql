-- =============================================================
-- FIX STOCK TRIGGERS (V11 - THE ULTIMATE CLEANUP & SILENT FIX)
-- TUJUAN: Menghapus semua jejak catatan "Barang Masuk" saat 
-- penghapusan/pembatalan transaksi agar kartu stok tetap bersih.
-- =============================================================

-- 1. HAPUS SEMUA TRIGGER LAMA (Pembersihan Total Semua Versi)
DROP TRIGGER IF EXISTS tr_restore_stock ON sale_items;
DROP TRIGGER IF EXISTS tr_deduct_stock ON sale_items;
DROP TRIGGER IF EXISTS tr_stock_movement ON sale_items;
DROP TRIGGER IF EXISTS tr_sale_status_stock ON sales;
DROP TRIGGER IF EXISTS tr_sync_stock ON sale_items;
DROP TRIGGER IF EXISTS tr_auto_stock ON sale_items;
DROP TRIGGER IF EXISTS tr_stock_handler ON sale_items;

-- 2. HAPUS FUNGSI-FUNGSI LAMA
DROP FUNCTION IF EXISTS fn_handle_stock_movement();
DROP FUNCTION IF EXISTS fn_handle_sale_status_change();
DROP FUNCTION IF EXISTS fn_deduct_stock_on_sale();
DROP FUNCTION IF EXISTS fn_restore_stock_on_delete();
DROP FUNCTION IF EXISTS fn_sync_stock_movements();

-- 3. FUNGSI BARU V11: PENANGAN STOK "DIAM-DIAM" (SILENT)
CREATE OR REPLACE FUNCTION fn_handle_stock_movement_v11()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id BIGINT;
    v_quantity_diff NUMERIC;
    v_is_delete BOOLEAN := (TG_OP = 'DELETE');
    v_is_update BOOLEAN := (TG_OP = 'UPDATE');
    v_is_insert BOOLEAN := (TG_OP = 'INSERT');
    v_sale_status TEXT;
    v_sale_id BIGINT;
    v_sale_item_id BIGINT;
    v_branch_id INTEGER;
    v_product_name TEXT;
    r_recipe RECORD;
BEGIN
    -- Identifikasi ID Penjualan dan Produk
    IF v_is_delete THEN
        v_sale_id := OLD.sale_id;
        v_sale_item_id := OLD.id;
        v_product_id := OLD.product_id;
        v_quantity_diff := -OLD.quantity;
    ELSE
        v_sale_id := NEW.sale_id;
        v_sale_item_id := NEW.id;
        v_product_id := NEW.product_id;
        v_quantity_diff := CASE WHEN v_is_insert THEN NEW.quantity ELSE NEW.quantity - OLD.quantity END;
    END IF;

    -- Ambil Status Penjualan
    SELECT status INTO v_sale_status FROM sales WHERE id = v_sale_id;
    v_sale_status := LOWER(COALESCE(v_sale_status, 'hold'));

    -- =========================================================
    -- OPERASI PENGHAPUSAN (DELETE) ATAU PENGURANGAN JUMLAH
    -- =========================================================
    IF v_is_delete OR (v_is_update AND v_quantity_diff < 0) THEN
        -- A. Hapus Catatan "Barang Keluar" yang sudah ada (Bersihkan Histori)
        DELETE FROM stock_movements WHERE sale_item_id = v_sale_item_id;
        
        -- B. Kembalikan stok fisik ke gudang (Hanya jika status Selesai)
        IF v_sale_status IN ('completed', 'selesai', 'slesai') THEN
            -- Restore Stok Produk/Bahan (Tanpa bikin catatan "Barang Masuk")
            UPDATE products SET stock = stock + ABS(v_quantity_diff) WHERE id = v_product_id;
            
            -- Restore Bahan dari Resep
            UPDATE ingredients i
            SET current_stock = i.current_stock + (pr.amount * ABS(v_quantity_diff))
            FROM product_recipes pr
            WHERE pr.product_id = v_product_id AND i.id = pr.ingredient_id;
        END IF;
        
        -- JANGAN LANJUT KE PEMBUATAN LOG (Keluar sekarang agar tidak ada tulisan "Barang Masuk")
        IF v_is_delete THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- =========================================================
    -- OPERASI TAMBAH (INSERT) ATAU PENAMBAHAN JUMLAH
    -- =========================================================
    IF v_sale_status IN ('completed', 'selesai', 'slesai') AND v_quantity_diff > 0 THEN
        -- Kurangi stok fisik
        UPDATE products SET stock = stock - v_quantity_diff WHERE id = v_product_id;
        
        -- Kurangi Bahan dari Resep
        UPDATE ingredients i
        SET current_stock = i.current_stock - (pr.amount * v_quantity_diff)
        FROM product_recipes pr
        WHERE pr.product_id = v_product_id AND i.id = pr.ingredient_id;

        -- Ambil Nama Produk dan Branch untuk Log
        SELECT branch_id, name INTO v_branch_id, v_product_name FROM products WHERE id = v_product_id;

        -- CATAT SEBAGAI "BARANG KELUAR"
        IF EXISTS (SELECT 1 FROM product_recipes WHERE product_id = v_product_id) THEN
            -- Catat pengeluaran tiap bahan baku berdasarkan resep
            INSERT INTO stock_movements (sale_item_id, ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason)
            SELECT 
                v_sale_item_id, pr.ingredient_id, i.name, v_branch_id, 'OUT', pr.amount * v_quantity_diff, i.unit, 'Penjualan: ' || v_product_name
            FROM product_recipes pr
            JOIN ingredients i ON i.id = pr.ingredient_id
            WHERE pr.product_id = v_product_id;
        ELSE
            -- Jika tidak ada resep, coba auto-match bahan baku dengan nama produk
            DECLARE
                v_match_id BIGINT; v_match_name TEXT; v_match_unit TEXT;
            BEGIN
                SELECT id, name, unit INTO v_match_id, v_match_name, v_match_unit FROM ingredients 
                WHERE (LOWER(TRIM(name)) = LOWER(TRIM(v_product_name)))
                  AND (branch_id = v_branch_id OR branch_id IS NULL) 
                ORDER BY (branch_id = v_branch_id) DESC LIMIT 1;
                
                IF v_match_id IS NOT NULL THEN
                    UPDATE ingredients SET current_stock = current_stock - v_quantity_diff WHERE id = v_match_id;
                    INSERT INTO stock_movements (sale_item_id, ingredient_id, ingredient_name, branch_id, type, quantity, unit, reason)
                    VALUES (v_sale_item_id, v_match_id, v_match_name, v_branch_id, 'OUT', v_quantity_diff, v_match_unit, 'Penjualan: ' || v_product_name);
                ELSE
                    -- Jika murni produk tanpa relasi ke bahan baku, catat sebagai product movement
                    INSERT INTO stock_movements (sale_item_id, product_id, type, quantity, reason)
                    VALUES (v_sale_item_id, v_product_id, 'OUT', v_quantity_diff, 'Penjualan: ' || v_product_name);
                END IF;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNGSI BARU V11: PENANGAN STATUS TRANSAKSI (BATAL/CANCEL)
CREATE OR REPLACE FUNCTION fn_handle_sale_status_v11()
RETURNS TRIGGER AS $$
BEGIN
    -- JIKA STATUS BERUBAH DARI 'SELESAI' KE 'BATAL' ATAU LAINNYA
    IF (OLD.status IN ('completed', 'selesai', 'slesai')) AND 
       (NEW.status NOT IN ('completed', 'selesai', 'slesai')) THEN
        
        -- 1. Hapus SEMUA catatan "Barang Keluar" untuk transaksi ini
        DELETE FROM stock_movements WHERE sale_item_id IN (SELECT id FROM sale_items WHERE sale_id = NEW.id);
        
        -- 2. Kembalikan stok fisik semua item di transaksi ini
        -- Kembalikan stok produk
        UPDATE products p
        SET stock = p.stock + sub.qty
        FROM (SELECT product_id, SUM(quantity) as qty FROM sale_items WHERE sale_id = NEW.id GROUP BY product_id) sub
        WHERE p.id = sub.product_id;
        
        -- Kembalikan stok bahan resep
        UPDATE ingredients i
        SET current_stock = i.current_stock + sub.total_qty
        FROM (
            SELECT pr.ingredient_id, SUM(pr.amount * si.quantity) as total_qty
            FROM sale_items si
            JOIN product_recipes pr ON si.product_id = pr.product_id
            WHERE si.sale_id = NEW.id
            GROUP BY pr.ingredient_id
        ) sub
        WHERE i.id = sub.ingredient_id;
        
        -- TIDAK ADA PEMBUATAN CATATAN "BARANG MASUK" DISINI
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. PASANG KEMBALI TRIGGER V11
DROP TRIGGER IF EXISTS tr_stock_movement_v11 ON sale_items;
CREATE TRIGGER tr_stock_movement_v11
AFTER INSERT OR UPDATE OR DELETE ON sale_items
FOR EACH ROW EXECUTE FUNCTION fn_handle_stock_movement_v11();

DROP TRIGGER IF EXISTS tr_sale_status_v11 ON sales;
CREATE TRIGGER tr_sale_status_v11
AFTER UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION fn_handle_sale_status_v11();
