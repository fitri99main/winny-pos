import { useState, useEffect, useRef } from 'react';
import {
    Clock, User, Calendar, Award, LogOut, FileText,
    ChevronRight, Bell, ShieldCheck, MapPin, QrCode,
    Briefcase, AlertCircle, CheckCircle, XCircle, PlayCircle, StopCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { PWAInstallButton } from '../ui/PWAInstallButton';

// --- Types ---
import { Employee } from '../employees/EmployeesView';

interface LeaveRequest {
    id: number;
    start_date: string;
    end_date: string;
    type: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    created_at: string;
}

// --- Main Component ---
export function ESSView() {
    const [mode, setMode] = useState<'IDLE' | 'DASHBOARD'>('IDLE');
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'ATTENDANCE' | 'SHIFT' | 'REWARD'>('PROFILE'); // Removed LEAVE

    // Auto Logout Logic
    const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);

    const resetLogoutTimer = () => {
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        if (mode === 'DASHBOARD') {
            logoutTimerRef.current = setTimeout(() => {
                handleLogout();
                toast.info('Sesi berakhir otomatis demi keamanan');
            }, 60000); // 1 minute timeout
        }
    };

    useEffect(() => {
        window.addEventListener('click', resetLogoutTimer);
        window.addEventListener('touchstart', resetLogoutTimer);
        return () => {
            window.removeEventListener('click', resetLogoutTimer);
            window.removeEventListener('touchstart', resetLogoutTimer);
            if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        };
    }, [mode]);

    const handleLogin = (employee: Employee) => {
        setCurrentUser(employee);
        setMode('DASHBOARD');
        setActiveTab('ATTENDANCE'); // Default to attendance after login as it's the primary action
        toast.success(`Selamat Datang, ${employee.name}`);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setMode('IDLE');
    };

    if (mode === 'IDLE') {
        return <IdleScreen onLogin={handleLogin} />;
    }

    return (
        <div className="h-[100dvh] w-full bg-gray-50 font-sans text-gray-800 flex flex-col overflow-hidden">
            {/* Header - Fixed at Top */}
            <div className="bg-white shadow-sm border-b border-gray-100 p-4 md:p-6 flex justify-between items-center shrink-0 z-40">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg md:text-xl shrink-0">
                        {currentUser?.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <h1 className="text-lg md:text-xl font-bold leading-tight truncate">{currentUser?.name}</h1>
                        <p className="text-xs md:text-sm text-gray-500 font-medium truncate">{currentUser?.position}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:block text-right">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Waktu Sekarang</p>
                        <ClockDisplay />
                    </div>
                    <PWAInstallButton />
                    <button
                        onClick={handleLogout}
                        className="p-2 md:p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 font-bold text-xs md:text-sm"
                    >
                        <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="hidden md:inline">Keluar</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area - Scrollable */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Desktop Sidebar Navigation (Hidden on Mobile) */}
                <div className="hidden md:flex w-80 bg-white border-r border-gray-100 p-4 flex-col gap-2 shrink-0 overflow-y-auto">
                    <NavButton
                        active={activeTab === 'ATTENDANCE'}
                        icon={<CheckCircle className="w-5 h-5" />}
                        label="Absensi (Presensi)"
                        onClick={() => setActiveTab('ATTENDANCE')}
                    />
                    <NavButton
                        active={activeTab === 'PROFILE'}
                        icon={<User className="w-5 h-5" />}
                        label="Profil Saya"
                        onClick={() => setActiveTab('PROFILE')}
                    />
                    <NavButton
                        active={activeTab === 'SHIFT'}
                        icon={<Calendar className="w-5 h-5" />}
                        label="Jadwal Shift"
                        onClick={() => setActiveTab('SHIFT')}
                    />
                    <NavButton
                        active={activeTab === 'REWARD'}
                        icon={<Award className="w-5 h-5" />}
                        label="Reward & Performa"
                        onClick={() => setActiveTab('REWARD')}
                    />
                </div>

                {/* Content - Document Scroll */}
                <div className="flex-1 w-full p-4 md:p-8 overflow-y-auto pb-32">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Mobile Clock Display */}
                        <div className="md:hidden bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-gray-500">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Waktu Server</span>
                            </div>
                            <ClockDisplay className="text-lg font-black text-primary" />
                        </div>

                        {activeTab === 'ATTENDANCE' && currentUser && <AttendanceTab employee={currentUser} />}
                        {activeTab === 'PROFILE' && currentUser && <ProfileTab employee={currentUser} />}
                        {activeTab === 'SHIFT' && currentUser && <ShiftTab employeeId={currentUser.id} />}
                        {/* Removed LeaveTab Render */}
                        {activeTab === 'REWARD' && currentUser && <RewardTab employee={currentUser} />}
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Navigation (Fixed) */}
            <div className="md:hidden fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-lg border border-gray-200 shadow-2xl rounded-3xl p-2 z-50 flex justify-around items-center">
                <MobileNavBtn active={activeTab === 'ATTENDANCE'} icon={<CheckCircle className="w-5 h-5" />} label="Absen" onClick={() => setActiveTab('ATTENDANCE')} />
                <MobileNavBtn active={activeTab === 'SHIFT'} icon={<Calendar className="w-5 h-5" />} label="Shift" onClick={() => setActiveTab('SHIFT')} />
                <MobileNavBtn active={activeTab === 'REWARD'} icon={<Award className="w-5 h-5" />} label="Reward" onClick={() => setActiveTab('REWARD')} />
                <MobileNavBtn active={activeTab === 'PROFILE'} icon={<User className="w-5 h-5" />} label="Profil" onClick={() => setActiveTab('PROFILE')} />
            </div>
        </div>
    );
}

// --- Mobile Components ---
const MobileNavBtn = ({ active, icon, label, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all w-16 ${active ? 'bg-primary text-white shadow-lg shadow-primary/30 -translate-y-2' : 'text-gray-400 hover:bg-gray-50'
            }`}
    >
        {icon}
        {active && <span className="text-[10px] font-bold mt-1">{label}</span>}
    </button>
);

// --- Sub-Screens ---

function IdleScreen({ onLogin }: { onLogin: (emp: Employee) => void }) {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [pinDisplay, setPinDisplay] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('employees').select('*');
            if (data) setEmployees(data.map(e => ({ ...e, joinDate: e.join_date, offDays: e.off_days || [] })));
        };
        fetchData();
    }, []);

    const handlePinSubmit = () => {
        // Validate against Employee PIN
        const emp = employees.find(e => (e.pin || String(e.id)) === pinDisplay);
        if (emp) {
            onLogin(emp);
            setPinDisplay('');
        } else {
            toast.error('PIN tidak valid. Silakan coba lagi.');
            setPinDisplay('');
        }
    };

    const handlePinPress = (num: string) => {
        if (num === 'C') setPinDisplay('');
        else if (num === 'BS') setPinDisplay(prev => prev.slice(0, -1));
        else if (pinDisplay.length < 6) setPinDisplay(prev => prev + num);
    };

    return (
        <div className="min-h-[100dvh] flex flex-col bg-gray-900 text-white font-sans items-center justify-center relative overflow-hidden pb-12">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 z-0" />
            <div className="relative z-10 w-full max-w-md p-6 flex flex-col items-center">
                <div className="mb-6 text-center animate-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-2xl border border-white/10">
                        <Clock className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <ClockDisplay className="text-4xl font-black tabular-nums tracking-tighter mb-1" />
                    <p className="text-gray-400 font-medium text-xs">Waktu Indonesia Barat</p>
                </div>

                <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-500 max-w-[320px] mx-auto">
                    <h3 className="text-lg font-bold text-center mb-1">Login Karyawan</h3>
                    <p className="text-gray-400 text-center text-[10px] mb-5">Masukkan 6-digit PIN Anda</p>

                    {/* PIN Display */}
                    <div className="bg-black/30 rounded-xl h-12 mb-5 flex items-center justify-center border border-white/5">
                        <div className="flex gap-2.5">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i < pinDisplay.length
                                        ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)] scale-110'
                                        : 'bg-white/20'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handlePinPress(String(num))}
                                className="aspect-square rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xl font-bold transition-all active:scale-90 flex items-center justify-center shadow-lg group"
                            >
                                <span className="group-hover:scale-110 transition-transform">{num}</span>
                            </button>
                        ))}
                        <button onClick={() => handlePinPress('C')} className="aspect-square rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 flex items-center justify-center transition-all active:scale-90 border border-red-500/10 text-lg">C</button>
                        <button onClick={() => handlePinPress('0')} className="aspect-square rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xl font-bold flex items-center justify-center transition-all active:scale-90">0</button>
                        <button onClick={handlePinSubmit} className="aspect-square rounded-xl bg-primary text-white shadow-lg shadow-primary/25 flex items-center justify-center transition-all active:scale-90 hover:bg-primary/90">
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <p className="mt-8 text-xs text-gray-500 text-center max-w-xs">
                    Jika belum memiliki PIN, silakan hubungi Manager atau Admin untuk pengaturan akses.
                </p>
            </div>
        </div>
    );
}

// --- Tabs ---

function AttendanceTab({ employee }: { employee: Employee }) {
    const [status, setStatus] = useState<'NONE' | 'CHECKED_IN' | 'CHECKED_OUT'>('NONE');
    const [todayLog, setTodayLog] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    const fetchStatus = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('attendance_logs')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('date', today)
            .single();

        if (data) {
            setTodayLog(data);
            if (data.check_out) setStatus('CHECKED_OUT');
            else setStatus('CHECKED_IN');
        } else {
            setStatus('NONE');
        }

        // Fetch history
        const { data: hist } = await supabase.from('attendance_logs')
            .select('*')
            .eq('employee_id', employee.id)
            .order('date', { ascending: false })
            .limit(5);
        if (hist) setHistory(hist);
    };

    useEffect(() => {
        fetchStatus();
    }, [employee]);

    const handleCheckIn = async () => {
        const now = new Date();
        const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        // Simple logic: Late if after 8 AM (Example)
        const isLate = now.getHours() >= 8 && now.getMinutes() > 0;

        const payload = {
            employee_id: employee.id,
            employee_name: employee.name,
            date: now.toISOString().split('T')[0],
            check_in: time,
            status: isLate ? 'Late' : 'Present'
        };

        const { error } = await supabase.from('attendance_logs').insert([payload]);
        if (error) toast.error('Check-In Gagal');
        else {
            toast.success('Berhasil Check-In! Selamat Bekerja.');
            fetchStatus();
        }
    };

    const handleCheckOut = async () => {
        if (!todayLog) return;
        const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const { error } = await supabase.from('attendance_logs')
            .update({ check_out: time })
            .eq('id', todayLog.id);

        if (error) toast.error('Check-Out Gagal');
        else {
            toast.success('Berhasil Check-Out! Hati-hati di jalan.');
            fetchStatus();
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {/* Status Card */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden">
                <div className={`absolute top-0 inset-x-0 h-2 ${status === 'NONE' ? 'bg-gray-200' :
                    status === 'CHECKED_IN' ? 'bg-green-500' : 'bg-blue-500'
                    }`} />

                <h2 className="text-2xl font-bold mb-2">Halo, {employee.name}!</h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    {status === 'NONE' ? 'Anda belum melakukan absensi hari ini. Silakan Check-In untuk mulai bekerja.' :
                        status === 'CHECKED_IN' ? 'Anda sedang bekerja (On Duty). Jangan lupa Check-Out sebelum pulang.' :
                            'Terima kasih! Anda sudah menyelesaikan shift hari ini.'}
                </p>

                <div className="flex justify-center gap-6">
                    {status === 'NONE' && (
                        <button
                            onClick={handleCheckIn}
                            className="bg-green-600 hover:bg-green-700 text-white px-10 py-6 rounded-3xl font-black text-xl shadow-xl shadow-green-200 flex flex-col items-center gap-2 transition-transform active:scale-95 w-full md:w-auto"
                        >
                            <PlayCircle className="w-8 h-8" />
                            MASUK (CHECK-IN)
                        </button>
                    )}

                    {status === 'CHECKED_IN' && (
                        <button
                            onClick={handleCheckOut}
                            className="bg-red-600 hover:bg-red-700 text-white px-10 py-6 rounded-3xl font-black text-xl shadow-xl shadow-red-200 flex flex-col items-center gap-2 transition-transform active:scale-95 w-full md:w-auto"
                        >
                            <StopCircle className="w-8 h-8" />
                            PULANG (CHECK-OUT)
                        </button>
                    )}

                    {status === 'CHECKED_OUT' && (
                        <div className="bg-blue-50 text-blue-800 px-8 py-4 rounded-2xl font-bold flex items-center gap-3">
                            <CheckCircle className="w-6 h-6" />
                            Absensi Hari Ini Selesai
                        </div>
                    )}
                </div>

                {todayLog && (
                    <div className="mt-8 pt-8 border-t border-gray-100 grid grid-cols-2 divide-x">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Jam Masuk</p>
                            <p className="text-2xl font-black text-gray-800">{todayLog.check_in}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Jam Pulang</p>
                            <p className="text-2xl font-black text-gray-800">{todayLog.check_out || '--:--'}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* History List */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-gray-400" /> Riwayat Terakhir
                </h3>
                <div className="space-y-3">
                    {history.map((h: any) => (
                        <div key={h.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                            <div>
                                <p className="font-bold text-sm">{h.date}</p>
                                <p className="text-xs text-gray-400">{h.status}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-sm">{h.check_in} - {h.check_out || '?'}</p>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Belum ada riwayat.</p>}
                </div>
            </div>
        </div>
    );
}

// Simple Icon wrapper to fix missing import if needed (though Lucide has History, aliasing it)
const HistoryIcon = Calendar;

function ProfileTab({ employee }: { employee: Employee }) {
    const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center text-4xl font-black text-gray-400 border-4 border-white shadow-xl">
                    {employee.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-4">
                    <div>
                        <h2 className="text-3xl font-black text-gray-800">{employee.name}</h2>
                        <p className="text-lg text-primary font-bold">{employee.position}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <InfoItem icon={<Briefcase />} label="Departemen" value={employee.department} />
                        <InfoItem icon={<MapPin />} label="Tanggal Bergabung" value={employee.joinDate} />
                        <InfoItem icon={<AlertCircle />} label="Jadwal Libur (Off Day)" value={employee.offDays.map(d => DAYS[d]).join(', ')} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ShiftTab({ employeeId }: { employeeId: number }) {
    const [schedules, setSchedules] = useState<any[]>([]);

    useEffect(() => {
        const fetchSchedules = async () => {
            // Mock or Real
        };
        fetchSchedules();
    }, [employeeId]);

    return (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 min-h-[400px] animate-in slide-in-from-right duration-500">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-primary" /> Jadwal Shift Saya
            </h2>
            <div className="text-center py-20 text-gray-400">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Belum ada jadwal shift yang dipublikasikan.</p>
            </div>
        </div>
    );
}

function LeaveTab({ employee }: { employee: Employee }) {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({ start: '', end: '', type: 'Cuti Tahunan', reason: '' });

    const fetchRequests = async () => {
        const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', employee.id).order('created_at', { ascending: false });
        if (data) setRequests(data as any);
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            employee_id: employee.id,
            employee_name: employee.name,
            start_date: formData.start,
            end_date: formData.end,
            type: formData.type,
            reason: formData.reason,
            status: 'Pending'
        };
        const { error } = await supabase.from('leave_requests').insert([payload]);
        if (error) toast.error(error.message);
        else {
            toast.success('Pengajuan cuti berhasil dikirim');
            setIsFormOpen(false);
            fetchRequests();
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="w-6 h-6 text-primary" /> Pengajuan Cuti
                </h2>
                <button onClick={() => setIsFormOpen(true)} className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                    + Ajukan Cuti
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-white p-6 rounded-3xl border border-primary/20 shadow-xl mb-6 animate-in zoom-in-95">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Tanggal Mulai</label>
                                <input type="date" required className="w-full p-3 bg-gray-50 rounded-xl" value={formData.start} onChange={e => setFormData({ ...formData, start: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Tanggal Selesai</label>
                                <input type="date" required className="w-full p-3 bg-gray-50 rounded-xl" value={formData.end} onChange={e => setFormData({ ...formData, end: e.target.value })} />
                            </div>
                        </div>
                        {/* ... rest of form (same as before) ... */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Jenis Cuti</label>
                            <select className="w-full p-3 bg-gray-50 rounded-xl" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option>Cuti Tahunan</option>
                                <option>Sakit</option>
                                <option>Izin</option>
                                <option>Lainnya</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Alasan</label>
                            <textarea required className="w-full p-3 bg-gray-50 rounded-xl h-24" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                        </div>
                        <div className="flex gap-4 pt-2">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold">Batal</button>
                            <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Kirim Pengajuan</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-3">
                {requests.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">Belum ada riwayat pengajuan cuti.</div>
                ) : requests.map(req => (
                    <div key={req.id} className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-gray-800">{req.type}</h4>
                            <p className="text-sm text-gray-500">{req.start_date} s/d {req.end_date} • {req.reason}</p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {req.status}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RewardTab({ employee }: { employee: Employee }) {
    return (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 animate-in slide-in-from-right duration-500">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-yellow-50 text-yellow-600 rounded-2xl">
                    <Award className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Reward & Performa</h2>
                    <p className="text-gray-500">Estimasi bonus bulan ini</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard label="Total Penjualan" value="Rp 0" subtext="Target: Rp 5.000.000" />
                <StatCard label="Kehadiran" value="0 Hari" subtext="Bonus: Rp 10.000/hari" />
                <StatCard label="Komplain" value="0" subtext="Denda: Rp 50.000/komplain" isNegative />
            </div>

            <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 text-center">
                <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">Estimasi Bonus Diterima</p>
                <div className="text-4xl font-black text-blue-600">Rp 0</div>
            </div>
        </div>
    );
}

// --- Helpers ---

const NavButton = ({ active, icon, label, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all text-left min-w-[200px] md:w-full ${active ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'bg-transparent text-gray-500 hover:bg-gray-50'
            }`}
    >
        {icon}
        <span>{label}</span>
        {active && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
    </button>
);

const ClockDisplay = ({ className = "text-xl font-bold text-gray-700" }: { className?: string }) => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return <div className={className}>{time.toLocaleTimeString('id-ID')}</div>;
};

const InfoItem = ({ icon, label, value }: any) => (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
        <div className="mt-1 text-gray-400">{icon}</div>
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
            <p className="font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const StatCard = ({ label, value, subtext, isNegative }: any) => (
    <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl">
        <p className="text-xs font-bold text-gray-400 uppercase mb-2">{label}</p>
        <p className={`text-2xl font-black mb-1 ${isNegative ? 'text-red-500' : 'text-gray-800'}`}>{value}</p>
        <p className="text-xs font-medium text-gray-500">{subtext}</p>
    </div>
);
