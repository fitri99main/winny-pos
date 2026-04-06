import { useState, useEffect, useRef } from 'react';
import {
    Clock, User, Calendar, Award, LogOut, FileText,
    ChevronRight, Bell, ShieldCheck, MapPin, QrCode,
    Briefcase, AlertCircle, CheckCircle, XCircle, PlayCircle, StopCircle, History
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
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'ATTENDANCE' | 'SHIFT' | 'REWARD'>('PROFILE');

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
        setActiveTab('ATTENDANCE'); 
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
            {/* Header */}
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

            <div className="flex-1 flex overflow-hidden relative">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-gray-100 p-6 gap-2 shrink-0 overflow-y-auto">
                    <NavButton active={activeTab === 'PROFILE'} icon={<User className="w-5 h-5" />} label="Profil Saya" onClick={() => setActiveTab('PROFILE')} />
                    <NavButton active={activeTab === 'ATTENDANCE'} icon={<ShieldCheck className="w-5 h-5" />} label="Absensi" onClick={() => setActiveTab('ATTENDANCE')} />
                    <NavButton active={activeTab === 'SHIFT'} icon={<Calendar className="w-5 h-5" />} label="Jadwal Kerja" onClick={() => setActiveTab('SHIFT')} />
                    <NavButton active={activeTab === 'REWARD'} icon={<Award className="w-5 h-5" />} label="Reward & Performa" onClick={() => setActiveTab('REWARD')} />
                </aside>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 pb-24 md:pb-8">
                    {activeTab === 'PROFILE' && currentUser && <ProfileTab employee={currentUser} />}
                    {activeTab === 'ATTENDANCE' && currentUser && <AttendanceTab employee={currentUser} />}
                    {activeTab === 'SHIFT' && currentUser && <ShiftTab employeeId={currentUser.id} />}
                    {activeTab === 'REWARD' && currentUser && <RewardTab employee={currentUser} />}
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 p-2 flex justify-around items-center z-50">
                <MobileNavItem active={activeTab === 'PROFILE'} icon={<User />} label="Profil" onClick={() => setActiveTab('PROFILE')} />
                <MobileNavItem active={activeTab === 'ATTENDANCE'} icon={<ShieldCheck />} label="Absen" onClick={() => setActiveTab('ATTENDANCE')} />
                <MobileNavItem active={activeTab === 'SHIFT'} icon={<Calendar />} label="Shift" onClick={() => setActiveTab('SHIFT')} />
                <MobileNavItem active={activeTab === 'REWARD'} icon={<Award />} label="Reward" onClick={() => setActiveTab('REWARD')} />
            </div>
        </div>
    );
}

// --- Sub-Components ---

function IdleScreen({ onLogin }: { onLogin: (emp: Employee) => void }) {
    const [pinDisplay, setPinDisplay] = useState('');
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const { data } = await supabase.from('employees').select('*');
            if (data) setEmployees(data);
        };
        fetchData();
    }, []);

    const handleNumberClick = (num: string) => {
        if (pinDisplay.length < 6) setPinDisplay(prev => prev + num);
    };

    const handleClear = () => setPinDisplay('');
    const handleDelete = () => setPinDisplay(prev => prev.slice(0, -1));

    const handleSubmit = () => {
        const emp = employees.find(e => (e.pin || String(e.id)) === pinDisplay);
        if (emp) {
            onLogin(emp);
            setPinDisplay('');
        } else {
            toast.error('PIN Salah');
            setPinDisplay('');
        }
    };

    return (
        <div className="h-[100dvh] w-full bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans overflow-hidden">
            <div className="text-center mb-8 animate-in fade-in zoom-in duration-700">
                <div className="w-20 h-20 bg-primary rounded-[30%] mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-primary/20 rotate-12">
                    <QrCode className="w-10 h-10 -rotate-12" />
                </div>
                <h1 className="text-3xl font-black mb-2 tracking-tight">WUDkopi ESS</h1>
                <p className="text-slate-400 font-medium">System Layanan Mandiri Karyawan</p>
                <div className="mt-4"><ClockDisplay className="text-2xl font-mono text-primary font-bold" /></div>
            </div>

            <div className="w-full max-w-sm space-y-8">
                <div className="h-16 flex justify-center items-center gap-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${i < pinDisplay.length ? 'bg-primary border-primary scale-125' : 'border-slate-700 bg-slate-800'}`} />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                        <button key={num} onClick={() => handleNumberClick(num)} className="h-16 bg-slate-800/50 hover:bg-slate-700 rounded-2xl text-2xl font-black transition-all active:scale-90 border border-slate-700/50">{num}</button>
                    ))}
                    <button onClick={handleClear} className="h-16 text-slate-400 font-bold hover:text-white uppercase text-xs">Clear</button>
                    <button onClick={() => handleNumberClick('0')} className="h-16 bg-slate-800/50 hover:bg-slate-700 rounded-2xl text-2xl font-black transition-all active:scale-90 border border-slate-700/50">0</button>
                    <button onClick={handleDelete} className="h-16 text-slate-400 font-bold hover:text-white uppercase text-xs flex items-center justify-center"><XCircle className="w-6 h-6" /></button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={pinDisplay.length < 1}
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                    MASUK KE DASHBOARD
                </button>
            </div>
        </div>
    );
}

function AttendanceTab({ employee }: { employee: Employee }) {
    const [status, setStatus] = useState<'NONE' | 'CHECKED_IN' | 'CHECKED_OUT'>('NONE');
    const [todayLog, setTodayLog] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    const fetchStatus = async () => {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const localDate = `${year}-${month}-${day}`;

            const { data, error } = await supabase.from('attendance_logs')
                .select('*')
                .eq('employee_id', employee.id)
                .eq('date', localDate)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Fetch Status Error:', error);
                toast.error('Gagal mengambil status: ' + error.message);
                return;
            }

            if (data && data.length > 0) {
                const log = data[0];
                setTodayLog(log);
                if (log.check_out) setStatus('CHECKED_OUT');
                else setStatus('CHECKED_IN');
            } else {
                setTodayLog(null);
                setStatus('NONE');
            }

            // Fetch history
            const { data: hist, error: histErr } = await supabase.from('attendance_logs')
                .select('*')
                .eq('employee_id', employee.id)
                .order('created_at', { ascending: false })
                .limit(5);
            
            if (histErr) console.error('Fetch History Error:', histErr);
            if (hist) setHistory(hist);
        } catch (err: any) {
            console.error('Fetch Status Exception:', err);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, [employee]);

    const handleCheckIn = async () => {
        try {
            const now = new Date();
            const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const localDate = `${year}-${month}-${day}`;

            const isLate = now.getHours() >= 9; // Example 9 AM

            const payload = {
                employee_id: employee.id,
                employee_name: employee.name || `Employee ${employee.id}`,
                branch_id: (employee as any).branch_id || null, // Capture branch_id if table has it
                date: localDate,
                check_in: time,
                status: isLate ? 'Late' : 'Present'
            };

            const { data, error } = await supabase.from('attendance_logs').insert([payload]).select();
            
            if (error) {
                console.error('Check-in error technical details:', error);
                toast.error(`Check-In Gagal (${error.code}): ${error.message}`);
            } else {
                toast.success('Berhasil Check-In!');
                fetchStatus();
            }
        } catch (err: any) {
            toast.error('Gagal memproses absensi keluar: ' + err.message);
        }
    };

    const handleCheckOut = async () => {
        if (!todayLog) return;
        try {
            const now = new Date();
            const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            const { error } = await supabase.from('attendance_logs')
                .update({ check_out: time })
                .eq('id', todayLog.id);

            if (error) {
                toast.error(`Check-Out Gagal: ${error.message}`);
            } else {
                toast.success('Berhasil Check-Out!');
                fetchStatus();
            }
        } catch (err: any) {
            toast.error('Gagal memproses absensi keluar');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden">
                <div className={`absolute top-0 inset-x-0 h-2 ${status === 'NONE' ? 'bg-slate-200' : status === 'CHECKED_IN' ? 'bg-green-500' : 'bg-blue-500'}`} />
                <h2 className="text-2xl font-bold mb-2">Halo, {employee.name}!</h2>
                <div className="flex justify-center gap-6 mt-8">
                    {status === 'NONE' && (
                        <button onClick={handleCheckIn} className="bg-green-600 hover:bg-green-700 text-white px-10 py-6 rounded-3xl font-black text-xl shadow-xl flex items-center gap-2"><PlayCircle /> CHECK-IN</button>
                    )}
                    {status === 'CHECKED_IN' && (
                        <button onClick={handleCheckOut} className="bg-red-600 hover:bg-red-700 text-white px-10 py-6 rounded-3xl font-black text-xl shadow-xl flex items-center gap-2"><StopCircle /> CHECK-OUT</button>
                    )}
                    {status === 'CHECKED_OUT' && (
                        <div className="bg-blue-50 text-blue-800 px-8 py-4 rounded-2xl font-bold">Shift Selesai</div>
                    )}
                </div>
                {todayLog && (
                    <div className="mt-8 pt-8 border-t border-gray-100 grid grid-cols-2 divide-x">
                        <div><p className="text-xs font-bold text-gray-400">Jam Masuk</p><p className="text-2xl font-black">{todayLog.check_in}</p></div>
                        <div><p className="text-xs font-bold text-gray-400">Jam Pulang</p><p className="text-2xl font-black">{todayLog.check_out || '--:--'}</p></div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><History className="w-5 h-5 text-gray-400" /> Riwayat Terakhir</h3>
                <div className="space-y-3">
                    {history.map((h: any) => (
                        <div key={h.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                            <div><p className="font-bold text-sm">{h.date}</p><p className="text-xs text-gray-400">{h.status}</p></div>
                            <div className="text-right font-bold text-sm">{h.check_in} - {h.check_out || '?'}</div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-center text-gray-400 py-4">Belum ada riwayat.</p>}
                </div>
            </div>
        </div>
    );
}

function ProfileTab({ employee }: { employee: Employee }) {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex gap-8 items-center">
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-3xl font-black text-white">{employee.name.charAt(0)}</div>
                <div><h2 className="text-3xl font-black text-gray-800">{employee.name}</h2><p className="text-lg text-primary font-bold">{employee.position}</p></div>
            </div>
        </div>
    );
}

function ShiftTab({ employeeId }: { employeeId: number }) {
    return <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 min-h-[400px] flex items-center justify-center text-gray-400">Belum ada jadwal shift.</div>;
}

function RewardTab({ employee }: { employee: Employee }) {
    return <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 min-h-[400px] flex items-center justify-center text-gray-400">Data reward belum tersedia.</div>;
}

// --- Helpers ---
const NavButton = ({ active, icon, label, onClick }: any) => (
    <button onClick={onClick} className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all w-full ${active ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}>{icon}<span>{label}</span></button>
);

const MobileNavItem = ({ active, icon, onClick }: any) => (
    <button onClick={onClick} className={`p-3 rounded-xl transition-all ${active ? 'bg-primary text-white' : 'text-gray-400'}`}>{icon}</button>
);

const ClockDisplay = ({ className }: { className?: string }) => {
    const [time, setTime] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
    return <div className={className}>{time.toLocaleTimeString('id-ID')}</div>;
};
