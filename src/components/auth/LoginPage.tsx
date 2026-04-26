import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Loader2, Lock, Mail, UserPlus, LogIn, Eye, EyeOff, User } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [statusText, setStatusText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatusText('Menghubungkan ke server...');

        // Safety timeout for UI
        const timeout = setTimeout(() => {
            if (loading) {
                setLoading(false);
                setStatusText('');
                toast.error('Koneksi lambat/timeout. Coba refresh halaman.');
            }
        }, 8000); // 8s max

        try {
            if (isSignUp) {
                // 1. PRE-REGISTRATION CHECK
                setStatusText('Mengecek data karyawan...');
                const { data: existingProfiles, error: checkError } = await supabase
                    .from('profiles')
                    .select('*')
                    .ilike('name', name)
                    .limit(1);

                if (checkError) throw new Error('Gagal memvalidasi data.');

                const matchedProfile = existingProfiles && existingProfiles[0];
                if (!matchedProfile) {
                    toast.error('PENDAFTARAN DITOLAK: Data Anda tidak ditemukan.');
                    setLoading(false);
                    return;
                }

                setStatusText('Mendaftarkan akun...');
                const { error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                    options: { data: { name: name, role: matchedProfile.role || 'Cashier' } }
                });

                if (error) throw error;

                if (matchedProfile.id) {
                    await supabase.from('profiles').delete().eq('id', matchedProfile.id);
                }

                toast.success('Akun berhasil dibuat! Silakan masuk.');
                setIsSignUp(false);

            } else {
                console.log('[Login] Starting login for:', email.trim());
                setStatusText('Memverifikasi kredensial...');
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });

                console.log('[Login] signInWithPassword returned:', { hasError: !!error, hasSession: !!data?.session });

                if (error) {
                    console.warn('[Login] Gagal:', error.message);
                    throw error;
                }

                setStatusText('Login berhasil! Mengalihkan...');
                toast.success('Selamat datang kembali!');

                // Force reload to ensure clean auth state
                navigate({
                    pathname: '/',
                    search: window.location.search
                });
            }
        } catch (error: any) {
            // Tampilkan pesan kustom sesuai permintaan user - Tanpa console.error agar tidak muncul layar merah
            toast.error('Cek email atau password anda salah!!!');
        } finally {
            clearTimeout(timeout);
            setLoading(false);
            setStatusText('');
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-gray-50">
            {/* Left Side - Brand / Image */}
            <div className="hidden lg:flex lg:w-1/2 bg-blue-600 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f5f7f] via-[#0c5874] to-[#083b51] z-10" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-overlay" />

                <div className="relative z-20 text-center p-12">
                    <div className="mx-auto mb-8 w-64 rounded-[2rem] bg-white/95 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm">
                        <img
                            src="/winny-coffee-login.jpg"
                            alt="Logo Winny Coffee"
                            className="h-auto w-full rounded-2xl object-contain"
                        />
                    </div>
                    <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">ERPPOS</h1>
                    <p className="text-xl text-gray-300 max-w-md mx-auto leading-relaxed">

                    </p>
                </div>

                {/* Decor */}
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 relative">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden mx-auto mb-5 w-40 rounded-3xl bg-white p-3 shadow-lg shadow-slate-200/80">
                            <img
                                src="/winny-coffee-login.jpg"
                                alt="Logo Winny Coffee"
                                className="h-auto w-full rounded-2xl object-contain"
                            />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                            {isSignUp ? 'Buat Akun' : 'Selamat Datang'}
                        </h2>
                        <p className="text-gray-500 mt-2">
                            {isSignUp ? 'Masukkan detail Anda untuk memulai' : 'Masuk ke akun Anda untuk melanjutkan'}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        {isSignUp && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Nama Lengkap</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    required
                                    autoComplete="on"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Kata Sandi</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    minLength={6}
                                    autoComplete="on"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-end">
                            {!isSignUp && (
                                <a href="#" className="text-sm font-medium text-primary hover:text-primary/80">Lupa kata sandi?</a>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                    {statusText || (isSignUp ? 'Membuat akun...' : 'Masuk...')}
                                </>
                            ) : (
                                <>
                                    {isSignUp ? <UserPlus className="w-5 h-5 mr-2" /> : <LogIn className="w-5 h-5 mr-2" />}
                                    {isSignUp ? 'Daftar' : 'Masuk'}
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="text-center pt-4 text-sm text-gray-500">
                        <span>{isSignUp ? 'Sudah punya akun?' : "Belum punya akun?"}</span>
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="ml-2 font-semibold text-primary hover:text-primary/80 transition-colors"
                        >
                            {isSignUp ? 'Masuk' : 'Buat Akun'}
                        </button>
                    </div>
                </div>

                <div className="absolute bottom-8 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} Sistem WinPOS. Hak cipta dilindungi undang-undang.
                </div>
            </div>
        </div>
    );
}
