const { createClient } = require('@supabase/supabase-js');

// Gunakan URL dan Key yang sama dengan check_db.cjs
const SUPABASE_URL = process.env.SUPABASE_URL || "https://bntpndyymvohxchigfuz.supabase.co";
// Kita perlu anon key atau service role key. Asumsikan kita bisa pakai file config atau jalankan lewat bash jika gagal.
// Tapi karena ini backend DB change, lebih aman kalau kita jalankan lewat node menggunakan creds yang ada di file env atau config project.
