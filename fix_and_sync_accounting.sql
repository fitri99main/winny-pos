-- DIAGNOSTIC & REPAIR SQL FOR ACCOUNTING MODULE

-- 1. Check if required accounts exist
SELECT code, name, type FROM public.accounts 
WHERE code IN ('101', '102', '104', '401', '501');

-- 2. If accounts are missing, seed them (Safe Operation)
INSERT INTO public.accounts (code, name, type)
VALUES 
    ('101', 'Kas', 'Asset'),
    ('102', 'Bank', 'Asset'),
    ('104', 'Persediaan', 'Asset'),
    ('401', 'Pendapatan Penjualan', 'Income'),
    ('501', 'Beban Pembelian', 'Expense')
ON CONFLICT (code) DO NOTHING;

-- 3. Check for existing Journal Entries for TODAY
SELECT * FROM public.journal_entries 
WHERE date = CURRENT_DATE
ORDER BY id DESC;

-- 4. Check for Sales that are Paid but NOT in Journal
SELECT s.order_no, s.total_amount, s.date
FROM public.sales s
LEFT JOIN public.journal_entries j ON j.description ILIKE 'Penjualan ' || s.order_no
WHERE s.status = 'Paid' AND j.id IS NULL;

-- 5. PERFORM SYNC (Run this to fix history)
DO $$
DECLARE
    sale_rec RECORD;
    debit_acc TEXT;
BEGIN
    FOR sale_rec IN 
        SELECT id, order_no, total_amount, payment_method, date 
        FROM public.sales 
        WHERE status = 'Paid'
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE description ILIKE 'Penjualan ' || sale_rec.order_no) THEN
            IF lower(COALESCE(sale_rec.payment_method, '')) IN ('cash', 'tunai') OR lower(COALESCE(sale_rec.payment_method, '')) LIKE '%tunai%' THEN
                debit_acc := '101';
            ELSE
                debit_acc := '102';
            END IF;

            INSERT INTO public.journal_entries (date, description, debit_account, credit_account, amount)
            VALUES (sale_rec.date::DATE, 'Penjualan ' || sale_rec.order_no, debit_acc, '401', sale_rec.total_amount);
        END IF;
    END LOOP;
END $$;
