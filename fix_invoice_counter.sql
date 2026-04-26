-- ================================================================
-- FIX: Sinkronisasi Counter Invoice (Terhindar dari Error 23505)
-- Tujuan: Mengatur 'invoice_last_number' di store_settings agar
--         sesuai dengan angka tertinggi di tabel sales saat ini.
-- ================================================================

DO $$
DECLARE
    max_num_online INTEGER;
    max_num_offline INTEGER;
BEGIN
    -- 1. Cari angka terakhir dari INV-XXXX (Online)
    -- Asumsi format INV-XXXX
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM 'INV-([0-9]+)') AS INTEGER)), 0)
    INTO max_num_online
    FROM public.sales
    WHERE order_no LIKE 'INV-%';

    -- 2. Cari angka terakhir dari OFF-XXXX (Offline)
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_no FROM 'OFF-([0-9]+)') AS INTEGER)), 0)
    INTO max_num_offline
    FROM public.sales
    WHERE order_no LIKE 'OFF-%';

    -- 3. Update store_settings
    UPDATE public.store_settings
    SET 
        invoice_last_number = max_num_online,
        offline_invoice_last_number = max_num_offline
    WHERE id = 1;

    RAISE NOTICE 'Online counter set to %, Offline set to %', max_num_online, max_num_offline;
END $$;
