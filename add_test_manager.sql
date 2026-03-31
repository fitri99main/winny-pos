-- 1. AKTIFKAN FITUR OTORISASI MANAGER
UPDATE public.store_settings 
SET enable_manager_auth = true 
WHERE id = 1;

-- 2. TAMBAHKAN AKUN TEST MANAGER (Cek jika sudah ada agar tidak error)
INSERT INTO public.employees (name, position, department, pin, email, status)
SELECT 'Test Manager', 'Manager', 'Management', '123456', 'test.manager@winny-pos.com', 'Active'
WHERE NOT EXISTS (
    SELECT 1 FROM public.employees WHERE email = 'test.manager@winny-pos.com'
);

-- Update PIN jika akun sudah ada tapi belum punya PIN
UPDATE public.employees 
SET pin = '123456', position = 'Manager', status = 'Active'
WHERE email = 'test.manager@winny-pos.com';

-- 3. VERIFIKASI (Opsional: Jalankan ini di SQL Editor untuk melihat hasilnya)
-- SELECT name, position, pin FROM public.employees WHERE position = 'Manager';
-- SELECT store_name, enable_manager_auth FROM public.store_settings;
