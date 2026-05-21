-- LEGACY / ARCHIVE
-- Jangan gunakan file ini untuk rollout baru.
-- Gunakan 03_wifi_voucher_trigger_optimization.sql sebagai jalur aktif.
--
-- 1. PAKSA PENGATURAN KE 15.000 (Menghilangkan ketidaksinkronan)
UPDATE public.store_settings 
SET 
    enable_wifi_vouchers = TRUE,
    wifi_voucher_min_amount = 15000,
    wifi_voucher_multiplier = 15000
WHERE id = 1;

-- 2. Fungsi untuk memberikan Voucher WiFi secara otomatis (v4 - STRICT 15K LOGIC)
CREATE OR REPLACE FUNCTION assign_wifi_voucher_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_voucher_count INTEGER := 0;
    v_min_spend NUMERIC;
    v_multiplier NUMERIC;
    v_enable_wifi BOOLEAN;
    v_voucher_id BIGINT;
    v_total NUMERIC;
    v_i INTEGER;
BEGIN
    -- Ambil pengaturan terbaru
    SELECT 
        enable_wifi_vouchers, 
        COALESCE(wifi_voucher_min_amount, 15000), 
        COALESCE(wifi_voucher_multiplier, 15000)
    INTO 
        v_enable_wifi, v_min_spend, v_multiplier
    FROM store_settings WHERE id = 1;
    
    v_total := COALESCE(NEW.total_amount, 0);

    -- Logika Kelipatan
    IF v_enable_wifi IS TRUE AND v_total >= v_min_spend THEN
        -- Hitung jatah: 15k=1, 30k=2, 45k=3, dst
        IF v_multiplier > 0 THEN
            v_voucher_count := FLOOR(v_total / v_multiplier);
        ELSE
            v_voucher_count := 1;
        END IF;

        -- Minimal kasih 1 jika sudah lewat min_spend
        IF v_voucher_count < 1 THEN v_voucher_count := 1; END IF;
        
        -- Batasi maksimal 10
        v_voucher_count := LEAST(v_voucher_count, 10);

        -- Hanya eksekusi saat status berubah jadi lunas
        IF (TG_OP = 'INSERT' AND LOWER(NEW.status) IN ('paid', 'selesai', 'completed', 'done')) OR
           (TG_OP = 'UPDATE' AND LOWER(NEW.status) IN ('paid', 'selesai', 'completed', 'done') AND 
            (OLD.status IS NULL OR LOWER(OLD.status) NOT IN ('paid', 'selesai', 'completed', 'done'))) THEN
            
            -- Hapus voucher lama jika ada (mencegah double jika di-update berulang)
            DELETE FROM wifi_vouchers WHERE sale_id = NEW.id;

            -- Ambil voucher baru sejumlah jatah
            FOR v_i IN 1..v_voucher_count LOOP
                UPDATE wifi_vouchers 
                SET is_used = TRUE, 
                    used_at = NOW(), 
                    sale_id = NEW.id
                WHERE id = (
                    SELECT id FROM wifi_vouchers 
                    WHERE is_used = FALSE 
                    ORDER BY created_at ASC 
                    LIMIT 1 
                    FOR UPDATE SKIP LOCKED
                );
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Pasang Ulang Trigger
DROP TRIGGER IF EXISTS trg_assign_wifi_voucher ON sales;
CREATE TRIGGER trg_assign_wifi_voucher
AFTER UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION assign_wifi_voucher_on_sale();

DROP TRIGGER IF EXISTS trg_assign_wifi_voucher_insert ON sales;
CREATE TRIGGER trg_assign_wifi_voucher_insert
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION assign_wifi_voucher_on_sale();
