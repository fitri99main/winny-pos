-- WINNY PORTAL: Bidirectional Synchronization (Karyawan -> Pengguna)
-- Jalankan kode ini di Supabase SQL Editor untuk memastikan perubahan di menu Karyawan
-- langsung memperbarui data di menu Pengguna/Aplikasi.

-- 1. FUNGSI UPDATE PROFIL DARI KARYAWAN
-- Fungsi ini akan dijalankan otomatis setiap kali data Karyawan ditambah atau diubah.
CREATE OR REPLACE FUNCTION public.sync_employee_to_profile() 
RETURNS trigger AS $$
BEGIN
    -- Update tabel Profile jika ada Email yang cocok
    UPDATE public.profiles
    SET 
        name = NEW.name,
        role = NEW.position -- Otomatis update Jabatan
    WHERE lower(email) = lower(NEW.email);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESET & PASANG TRIGGER PADA TABEL EMPLOYEES
DROP TRIGGER IF EXISTS on_employee_changed ON public.employees;

CREATE TRIGGER on_employee_changed
  AFTER INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE PROCEDURE public.sync_employee_to_profile();

-- 3. VERIFIKASI SEKARANG (OPSIONAL)
-- Query ini untuk mengetes hasil sinkronisasi secara manual jika diinginkan
/*
SELECT e.name, p.name as user_name, e.position, p.role 
FROM public.employees e
JOIN public.profiles p ON lower(e.email) = lower(p.email);
*/
