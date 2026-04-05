-- 1. CLEANUP & PREP
-- Hapus kebijakan lama yang mungkin menyebabkan rekursi (looping) atau error 400
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Pastikan RLS Aktif
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. KEBIJAKAN BARU: JWT-BASED ROLE CHECK
-- Menggunakan JWT jauh lebih aman karena tidak perlu mengecek tabel profil berulang-ulang (menghindari rekursi)

-- SIAPA SAJA BISA MELIHAT PROFIL (Agar daftar pengguna muncul)
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING ( true );

-- HANYA ADMINISTRATOR YANG BISA EDIT (UPDATE) Profil Orang Lain
-- Kita cek metadata role di dalam Token (JWT) user yang sedang login.
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles FOR ALL
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'Administrator'
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'Administrator'
);

-- HANYA USER SENDIRI YANG BISA EDIT Profil Mereka (Opsional, untuk User biasa)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE
USING ( auth.uid() = id );

-- 3. PERBAIKAN TRIGGER (PENANGKAP PENDAFTARAN)
-- Memastikan Metadata 'branch_id' dan 'role' tertangkap dengan benar saat pendaftaran akun
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, branch_id, role, status)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'User Baru'),
    COALESCE(new.raw_user_meta_data->>'branch_id', '7'), -- Default ke Cabang Utama '7' jika kosong
    COALESCE(new.raw_user_meta_data->>'role', 'Kasir'), -- Gunakan metadata role jika ada
    'Aktif'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RE-LINK TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  
-- SELESAI. Silakan jalankan ini di SQL Editor Supabase Anda.
