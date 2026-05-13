-- 1. Tambahkan kolom payment_method ke tabel purchases jika belum ada
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Tunai';

-- 2. Pastikan akun-akun yang diperlukan tersedia di Chart of Accounts (COA)
INSERT INTO public.accounts (code, name, type) VALUES
    ('105', 'Kas Kecil', 'Asset'),
    ('201', 'Hutang Usaha', 'Liability')
ON CONFLICT (code) DO NOTHING;

-- 3. Fungsi Otomatis untuk Sinkronisasi Pembelian ke Akuntansi Berdasarkan Metode Bayar
CREATE OR REPLACE FUNCTION public.sync_purchase_to_accounting() 
RETURNS trigger AS $$
DECLARE
    credit_acc TEXT;
    v_payment_method TEXT;
BEGIN
    -- Hanya proses jika status berubah menjadi 'Completed' atau 'Selesai'
    IF (NEW.status IN ('Completed', 'Selesai') AND (OLD.status IS NULL OR OLD.status NOT IN ('Completed', 'Selesai'))) THEN
        
        v_payment_method := lower(COALESCE(NEW.payment_method, 'Tunai'));

        -- Tentukan akun kredit berdasarkan metode pembayaran
        IF v_payment_method IN ('cash', 'tunai') THEN
            credit_acc := '101'; -- Kas
        ELSIF v_payment_method IN ('transfer', 'bank') THEN
            credit_acc := '102'; -- Bank
        ELSIF v_payment_method IN ('kas kecil', 'petty cash') THEN
            credit_acc := '105'; -- Kas Kecil
        ELSIF v_payment_method IN ('hutang', 'credit', 'utang') THEN
            credit_acc := '201'; -- Hutang Usaha (Liability)
        ELSE
            credit_acc := '101'; -- Default ke Kas jika tidak dikenal
        END IF;

        -- Masukkan ke Jurnal Akuntansi (Debit: 501 Pembelian Bahan Baku, Credit: Akun terpilih)
        INSERT INTO public.journal_entries (date, description, debit_account, credit_account, amount, reference_id, source_type)
        VALUES (
            NEW.date, 
            'Pembelian ' || NEW.purchase_no || ' (' || NEW.supplier_name || ') - via ' || NEW.payment_method, 
            '501', 
            credit_acc, 
            NEW.total_amount,
            NEW.id::TEXT,
            'purchase'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Pasang Trigger ke tabel purchases
DROP TRIGGER IF EXISTS trg_sync_purchase_to_accounting ON public.purchases;
CREATE TRIGGER trg_sync_purchase_to_accounting
AFTER UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.sync_purchase_to_accounting();

-- 5. SINKRONISASI ULANG DATA LAMA (Opsional)
-- Memperbarui entri jurnal lama agar mengikuti metode pembayaran yang benar
DO $$
DECLARE
    pur_rec RECORD;
    credit_acc TEXT;
    v_method TEXT;
BEGIN
    FOR pur_rec IN 
        SELECT * FROM public.purchases WHERE status IN ('Completed', 'Selesai')
    LOOP
        -- Cek apakah sudah ada jurnalnya (agar tidak double)
        IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE description ILIKE 'Pembelian ' || pur_rec.purchase_no || '%') THEN
            
            v_method := lower(COALESCE(pur_rec.payment_method, 'Tunai'));

            IF v_method IN ('cash', 'tunai') THEN
                credit_acc := '101';
            ELSIF v_method IN ('transfer', 'bank') THEN
                credit_acc := '102';
            ELSIF v_method IN ('kas kecil', 'petty cash') THEN
                credit_acc := '105';
            ELSIF v_method IN ('hutang', 'credit', 'utang') THEN
                credit_acc := '201';
            ELSE
                credit_acc := '101';
            END IF;

            INSERT INTO public.journal_entries (date, description, debit_account, credit_account, amount, reference_id, source_type)
            VALUES (
                pur_rec.date, 
                'Pembelian ' || pur_rec.purchase_no || ' (' || pur_rec.supplier_name || ') - via ' || COALESCE(pur_rec.payment_method, 'Tunai'), 
                '501', 
                credit_acc, 
                pur_rec.total_amount,
                pur_rec.id::TEXT,
                'purchase'
            );
        ELSE
            -- Jika sudah ada tapi belum punya reference_id, update agar sinkron
            UPDATE public.journal_entries 
            SET reference_id = pur_rec.id::TEXT, source_type = 'purchase'
            WHERE description ILIKE 'Pembelian ' || pur_rec.purchase_no || '%'
            AND reference_id IS NULL;
        END IF;
    END LOOP;
END;
$$;
