import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Store, Loader2, Lock, Mail, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
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
                // ... (Sign up logic remains same, abstracted for brevity but effectively inside the existing block if I don't change logic structure too much)
                // Actually user only complains about spinning, so likely Login flow.
                // Keeping existing sign up logic structure by just copying the block or using the original content if I can.
                // Re-writing the block to be safe.

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
                    email,
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
                setStatusText('Memverifikasi kredensial...');
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                setStatusText('Login berhasil! Mengalihkan...');
                toast.success('Selamat datang kembali!');

                // Force reload to ensure clean auth state
                navigate('/');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Autentikasi gagal');
        } finally {
            clearTimeout(timeout);
            setLoading(false);
            setStatusText('');
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-gray-50">
            {/* Left Side - Brand / Image */}
            <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-gray-900 z-10" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 grayscale" />

                <div className="relative z-20 text-center p-12">
                    <div className="w-24 h-24 bg-primary/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/20 border border-white/10">
                        <Store className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">Sistem WinPOS</h1>
                    <p className="text-xl text-gray-300 max-w-md mx-auto leading-relaxed">
                        Solusi Point of Sales paling canggih dan elegan untuk pertumbuhan bisnis Anda.
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
                        <div className="lg:hidden w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <Store className="w-6 h-6 text-primary" />
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
                                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                        placeholder="Nama Anda"
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
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                    placeholder="name@company.com"
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
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                    placeholder="••••••••"
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
                            className="w-full h-12 bg-gray-900 hover:bg-black text-white text-base font-semibold rounded-xl shadow-xl shadow-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
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

                    <div className="text-center pt-4">
                        <p className="text-sm text-gray-500">
                            {isSignUp ? 'Sudah punya akun?' : "Belum punya akun?"}
                            <button
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="ml-2 font-semibold text-primary hover:text-primary/80 transition-colors"
                            >
                                {isSignUp ? 'Masuk' : 'Buat Akun'}
                            </button>
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-8 text-center text-xs text-gray-400">
                    &copy; {new Date().getFullYear()} Sistem WinPOS. Hak cipta dilindungi undang-undang.
                </div>
            </div>
        </div>
    );
}
