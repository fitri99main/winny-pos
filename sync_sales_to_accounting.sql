-- SYNC EXISTING SALES TO JOURNAL ENTRIES (REVENUE SIDE)
-- This script will create journal entries for sales that don't have one yet.

DO $$
DECLARE
    sale_rec RECORD;
    debit_acc TEXT;
    journal_id BIGINT;
BEGIN
    FOR sale_rec IN 
        SELECT id, order_no, total_amount, payment_method, date 
        FROM public.sales 
        WHERE status = 'Paid'
    LOOP
        -- Check if entry already exists
        IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE description ILIKE 'Penjualan ' || sale_rec.order_no) THEN
            
            -- Determine debit account (101 for Cash/Tunai, 102 for others)
            IF lower(COALESCE(sale_rec.payment_method, '')) IN ('cash', 'tunai') OR lower(COALESCE(sale_rec.payment_method, '')) LIKE '%tunai%' THEN
                debit_acc := '101';
            ELSE
                debit_acc := '102';
            END IF;

            -- Insert Revenue Entry
            INSERT INTO public.journal_entries (date, description, debit_account, credit_account, amount)
            VALUES (
                sale_rec.date::DATE, 
                'Penjualan ' || sale_rec.order_no, 
                debit_acc, 
                '401', 
                sale_rec.total_amount
            );
            
            RAISE NOTICE 'Synced Sale: %', sale_rec.order_no;
        END IF;
    END LOOP;
END $$;
