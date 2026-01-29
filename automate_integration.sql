-- WINNY PORTAL: Automated User-Employee Integration Trigger
-- Jalankan kode ini di Supabase SQL Editor untuk mengaktifkan integrasi otomatis.

-- 1. FUNGSI PENANGAN USER BARU (DIREVISI)
-- Fungsi ini akan dijalankan otomatis setiap kali ada orang mendaftar (Signup).
-- Ia akan mencari apakah email pendaftar ada di daftar Karyawan.
CREATE OR REPLACE FUNCTION public.handle_new_user_integration() 
RETURNS trigger AS $$
DECLARE
    emp_record RECORD;
BEGIN
    -- Cari data di tabel karyawan berdasarkan email (case-insensitive)
    SELECT name, position INTO emp_record 
    FROM public.employees 
    WHERE lower(email) = lower(new.email)
    LIMIT 1;

    -- Jika data karyawan DITEMUKAN:
    IF emp_record IS NOT NULL THEN
        INSERT INTO public.profiles (id, email, name, role)
        VALUES (
            new.id, 
            new.email, 
            emp_record.name, 
            emp_record.position -- Otomatis pakai jabatan dari HRD sebagai role
        );
    -- Jika data karyawan TIDAK DITEMUKAN:
    ELSE
        INSERT INTO public.profiles (id, email, name, role)
        VALUES (
            new.id, 
            new.email, 
            COALESCE(new.raw_user_meta_data->>'name', 'User Baru'), 
            'Kasir' -- Default role jika bukan karyawan
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESET & PASANG TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_integration();

-- 3. SINKRONISASI DATA LAMA (RUN ONCE)
-- Untuk user yang sudah terlanjur mendaftar sebelum trigger ini ada.
INSERT INTO public.profiles (id, email, name, role)
SELECT 
    au.id, 
    au.email, 
    e.name, 
    e.position
FROM auth.users au
JOIN public.employees e ON lower(au.email) = lower(e.email)
ON CONFLICT (id) DO UPDATE 
SET 
    name = EXCLUDED.name,
    role = EXCLUDED.role;
