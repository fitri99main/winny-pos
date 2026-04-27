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
        }, 12000); // Increased timeout for email delivery

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
                // For passwordless signup, we still need a dummy password for the identity provider
                // but we won't ask the user for it.
                const ghostPassword = email.trim() + "_winpos_ghost";
                
                const { error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: ghostPassword,
                    options: { data: { name: name, role: matchedProfile.role || 'Cashier' } }
                });

                if (error) throw error;

                if (matchedProfile.id) {
                    await supabase.from('profiles').delete().eq('id', matchedProfile.id);
                }

                toast.success('Akun berhasil dibuat! Silakan cek email Anda untuk konfirmasi pendaftaran.');
                setIsSignUp(false);

            } else {
                console.log('[Login] Starting Passwordless Login (Magic Link) for:', email.trim());
                setStatusText('Mengirim link verifikasi ke email...');
                
                const { error } = await supabase.auth.signInWithOtp({
                    email: email.trim(),
                    options: {
                        emailRedirectTo: window.location.origin
                    }
                });

                if (error) {
                    console.warn('[Login] Gagal:', error.message);
                    throw error;
                }

                setStatusText('Link dikirim! Silakan cek email Anda.');
                toast.success('Link verifikasi telah dikirim ke email ' + email);
            }
        } catch (error: any) {
            toast.error(error.message || 'Terjadi kesalahan saat autentikasi.');
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
                        Sistem POS Modern untuk Winny Coffee
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
                            {isSignUp ? 'Buat Akun' : 'Masuk Sistem'}
                        </h2>
                        <p className="text-gray-500 mt-2">
                            {isSignUp ? 'Daftar menggunakan email aktif' : 'Gunakan email Anda untuk menerima link masuk'}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        {isSignUp && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1 font-bold">Nama Lengkap</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        placeholder="Masukkan nama lengkap"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm font-bold"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1 font-bold">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    required
                                    autoComplete="on"
                                    placeholder="nama@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm font-bold"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 ml-1 uppercase font-black tracking-widest">
                                {!isSignUp ? 'Link verifikasi akan dikirim ke email ini' : 'Gunakan email yang valid untuk verifikasi'}
                            </p>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-gray-900 hover:bg-black text-white text-base font-black rounded-2xl shadow-xl shadow-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {statusText || (isSignUp ? 'Memproses...' : 'Mengirim...')}
                                </>
                            ) : (
                                <>
                                    {isSignUp ? <UserPlus className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                    {isSignUp ? 'Daftar Sekarang' : 'Dapatkan Link Masuk'}
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="text-center pt-4 text-sm text-gray-500">
                        <span>{isSignUp ? 'Sudah punya akun?' : "Belum punya akun?"}</span>
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="ml-2 font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-widest text-[11px]"
                        >
                            {isSignUp ? 'Masuk Saja' : 'Buat Akun Baru'}
                        </button>
                    </div>
                </div>

                <div className="absolute bottom-8 text-center text-xs text-gray-400 font-bold uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} WinPOS System &bull; Version 2.0.0
                </div>
            </div>
        </div>
    );
}
