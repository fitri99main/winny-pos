-- WINNY PORTAL: Full One-Step Automation (Karyawan -> Pengguna)
-- Jalankan kode ini di Supabase SQL Editor.
-- EFEK: Cukup isi data Karyawan, Akun Login akan otomatis dibuatkan.

-- 0. PASTIKAN EKSTENSI TERPASANG
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. FUNGSI AUTO-CREATE ACCOUNT
-- Fungsi ini akan membuatkan akun di auth.users secara otomatis.
CREATE OR REPLACE FUNCTION public.auto_provision_user_account() 
RETURNS trigger AS $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    default_password_hash TEXT := crypt('Winny123!', gen_salt('bf')); -- Password Default: Winny123!
BEGIN
    -- Hanya jalankan jika Email diisi dan akun tersebut BELUM ada di auth.users
    IF NEW.email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email) THEN
        
        -- Masukkan ke tabel internal Supabase Auth
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            aud,
            role,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        )
        VALUES (
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            NEW.email,
            default_password_hash,
            current_timestamp,
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object('name', NEW.name),
            'authenticated',
            'authenticated',
            current_timestamp,
            current_timestamp,
            '', '', '', ''
        );

        -- ID Baru ini akan otomatis memicu trigger on_auth_user_created 
        -- yang sudah kita buat sebelumnya untuk sinkronisasi Profil.
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESET & PASANG TRIGGER PADA TABEL EMPLOYEES
DROP TRIGGER IF EXISTS on_employee_added_provisioning ON public.employees;

CREATE TRIGGER on_employee_added_provisioning
  AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE PROCEDURE public.auto_provision_user_account();

-- 3. CATATAN PENTING (BACA):
/*
   - PASSWORD DEFAULT untuk semua akun baru adalah: Winny123!
   - Karyawan bisa langsung login menggunakan email mereka dan password di atas.
   - Jika Anda mengubah email di kemudian hari, Anda mungkin perlu menyesuaikan akun manual.
*/
