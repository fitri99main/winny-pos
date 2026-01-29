-- WINNY PORTAL: Audit Account Synchronization
-- Jalankan kode ini di Supabase SQL Editor untuk melihat ketidaksinkronan data.

-- ==========================================================
-- 1. KARYAWAN YANG BELUM PUNYA AKUN LOGIN (URGENT)
-- ==========================================
-- Daftar orang yang sudah ada di data Karyawan tapi belum bisa login 
-- karena Email mereka belum terdaftar di Sistem Autentikasi.
SELECT 
    'BELUM PUNYA AKUN' as status,
    name as nama_karyawan, 
    email as email_hrd, 
    position as jabatan, 
    department as departemen
FROM public.employees
WHERE lower(email) NOT IN (SELECT lower(email) FROM auth.users)
   OR email IS NULL
ORDER BY name ASC;


-- ==========================================================
-- 2. PENGGUNA YANG TIDAK TERDAFTAR SEBAGAI KARYAWAN (WARNING)
-- ==========================================
-- Daftar akun yang bisa login tapi data personilnya tidak ada di HRD.
-- Hal ini menyebabkan mereka tidak bisa Absensi atau melihat Slip Gaji.
SELECT 
    'HANYA PUNYA LOGIN' as status,
    name as nama_user, 
    email as email_login, 
    role as wewenang_sistem
FROM public.profiles
WHERE lower(email) NOT IN (SELECT lower(email) FROM public.employees)
ORDER BY name ASC;


-- ==========================================================
-- 3. RINGKASAN STATISTIK (OVERVIEW)
-- ==========================================
SELECT 
    (SELECT count(*) FROM public.employees) as total_karyawan,
    (SELECT count(*) FROM auth.users) as total_akun_login,
    (SELECT count(*) FROM public.employees WHERE lower(email) IN (SELECT lower(email) FROM auth.users)) as sudah_sinkron;
