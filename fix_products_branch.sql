-- MASTER FIX SCRIPT (UPDATED)
-- Skrip ini akan:
-- 1. Memastikan kolom 'branch_id' ada di SEMUA tabel.
-- 2. Memastikan kolom 'table_no' dan 'customer_name' ada di tabel SALES.
-- 3. Membuat cabang "Winny Cafe Pangeran Natakusuma" jika belum ada.
-- 4. Memindahkan SEMUA data ke cabang tersebut.

-- A. PASTIKAN KOLOM ADA (Schema Patch)
DO $$ 
BEGIN 
    -- 1. Products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'branch_id') THEN
        ALTER TABLE public.products ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;

    -- 2. Ingredients
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredients' AND column_name = 'branch_id') THEN
        ALTER TABLE public.ingredients ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;

    -- 3. Tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'branch_id') THEN
        ALTER TABLE public.tables ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;

    -- 4. Employees
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'branch_id') THEN
        ALTER TABLE public.employees ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;

    -- 5. Sales (Branch ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'branch_id') THEN
        ALTER TABLE public.sales ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;

    -- 5b. Sales (Item & Customer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'table_no') THEN
        ALTER TABLE public.sales ADD COLUMN table_no TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'customer_name') THEN
        ALTER TABLE public.sales ADD COLUMN customer_name TEXT;
    END IF;
    
    -- 6. Purchases
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'branch_id') THEN
        ALTER TABLE public.purchases ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;

     -- 7. Stock Movements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'branch_id') THEN
        ALTER TABLE public.stock_movements ADD COLUMN branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- B. BUAT CABANG & PINDAHKAN DATA
DO $$ 
DECLARE 
    target_branch_id BIGINT;
    target_name TEXT := 'Winny Cafe Pangeran Natakusuma';
BEGIN 
    -- 1. Coba cari ID cabang
    SELECT id INTO target_branch_id FROM public.branches WHERE name ILIKE target_name LIMIT 1;

    -- 2. Jika tidak ditemukan, BUAT BARU
    IF target_branch_id IS NULL THEN
        INSERT INTO public.branches (name, address, phone, status)
        VALUES (target_name, 'Jl. Pangeran Natakusuma', '-', 'Active')
        RETURNING id INTO target_branch_id;
        RAISE NOTICE 'Cabang baru dibuat dengan ID: %', target_branch_id;
    ELSE
        RAISE NOTICE 'Cabang ditemukan dengan ID: %', target_branch_id;
    END IF;

    -- 3. Pindahkan SEMUA data ke cabang ini
    UPDATE public.products SET branch_id = target_branch_id;
    UPDATE public.tables SET branch_id = target_branch_id;
    UPDATE public.employees SET branch_id = target_branch_id;
    UPDATE public.ingredients SET branch_id = target_branch_id;
    UPDATE public.sales SET branch_id = target_branch_id;
    UPDATE public.purchases SET branch_id = target_branch_id;
    UPDATE public.stock_movements SET branch_id = target_branch_id;

    RAISE NOTICE 'SELESAI! Struktur tabel diperbaiki (termasuk kolom branch_id, table_no, customer_name) dan data dipindahkan.';
END $$;
