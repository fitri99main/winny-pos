import { useState, useEffect, useRef } from 'react';
import { 
    Clock as ClockIcon, Fingerprint, UserCheck, XCircle, RefreshCw, 
    ArrowLeft, ShieldCheck, Users, CheckCircle,
    AlertCircle, LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fingerprint, FingerprintResult } from '../../lib/fingerprint';
import { toast } from 'sonner';
import { Employee } from '../employees/EmployeesView';

type KioskMode = 'SCANNING' | 'RESULT';

export function AttendanceKiosk() {
    const KIOSK_FP_THRESHOLD = 9.5;
    const KIOSK_FP_AMBIGUITY_GAP = 0.5;
    const KIOSK_FP_AMBIGUITY_MIN = 4.5;
    const KIOSK_MIN_REGISTERED_SCANS = 2;
    const navigate = useNavigate();
    const [mode, setMode] = useState<KioskMode>('SCANNING');
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [fpStatus, setFpStatus] = useState<string>('Menghubungkan Scanner...');
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [todayStats, setTodayStats] = useState({ present: 0, late: 0, total: 0 });

    const employeesRef = useRef<Employee[]>([]);
    const modeRef = useRef<KioskMode>('SCANNING');
    const processingRef = useRef(false);

    useEffect(() => { modeRef.current = mode; }, [mode]);

    const fetchData = async () => {
        const today = new Date().toISOString().split('T')[0];
        try {
            const { data: emps } = await supabase.from('employees').select('*');
            const { data: logData } = await supabase.from('attendance_logs').select('*').eq('date', today).order('created_at', { ascending: false });
            const { data: schedData } = await supabase.from('shift_schedules').select('*, shifts(*)').eq('date', today);

            if (emps) { setEmployees(emps); employeesRef.current = emps; }
            if (logData) setLogs(logData);
            if (schedData) setSchedules(schedData);
        } catch (err: any) { console.error('Kiosk Fetch Error:', err); }
    };

    useEffect(() => {
        fetchData();
        const attendanceSubscription = supabase.channel('kiosk_attendance').on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, fetchData).subscribe();
        const employeeSubscription = supabase.channel('kiosk_attendance_employees').on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fetchData).subscribe();
        return () => {
            attendanceSubscription.unsubscribe();
            employeeSubscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const now = new Date().toISOString().split('T')[0];
        const todayLogs = logs.filter(l => l.date === now);
        const todaySchedules = schedules.filter(s => s.date === now);
        setTodayStats({ present: todayLogs.length, late: todayLogs.filter(l => l.status === 'Late').length, total: todaySchedules.length });
    }, [logs, schedules]);

    const resetKiosk = () => {
        setMode('SCANNING');
        setFpStatus('Tempel Jari...');
    };

    const processAttendance = async (employee: Employee) => {
        if (processingRef.current) return;
        processingRef.current = true;
        setIsProcessing(true);

        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toISOString().split('T')[0];
            const { data: existingLogs } = await supabase.from('attendance_logs').select('*').eq('employee_id', employee.id).eq('date', dateStr).order('created_at', { ascending: false }).limit(1);
            const lastLog = existingLogs?.[0];

            if (lastLog && !lastLog.check_out) {
                const schedule = schedules.find(s => String(s.employee_id) === String(employee.id));
                const endTimeStr = schedule?.custom_end_time || schedule?.shifts?.end_time;
                let overtimeMinutes = 0;
                if (endTimeStr) {
                    const [endH, endM] = endTimeStr.split(':').map(Number);
                    const shiftEndDate = new Date(now);
                    shiftEndDate.setHours(endH, endM, 0, 0);
                    if (now > shiftEndDate) overtimeMinutes = Math.floor((now.getTime() - shiftEndDate.getTime()) / 60000);
                }
                await supabase.from('attendance_logs').update({ check_out: timeStr, duration_minutes: Math.floor((now.getTime() - new Date(lastLog.created_at).getTime()) / 60000), overtime_minutes: Math.max(0, overtimeMinutes) }).eq('id', lastLog.id);
                setLastScanResult({ success: true, name: employee.name, time: timeStr, type: 'OUT', status: 'Hati-hati di jalan!' });
            } else {
                const schedule = schedules.find(s => String(s.employee_id) === String(employee.id));
                const startTimeStr = schedule?.custom_start_time || schedule?.shifts?.start_time;
                let lateMinutes = 0;
                let status = 'Present';
                if (startTimeStr) {
                    const [startH, startM] = startTimeStr.split(':').map(Number);
                    const shiftStartDate = new Date(now);
                    shiftStartDate.setHours(startH, startM, 0, 0);
                    if (now > shiftStartDate) { lateMinutes = Math.floor((now.getTime() - shiftStartDate.getTime()) / 60000); status = 'Late'; }
                }
                await supabase.from('attendance_logs').insert([{ employee_id: employee.id, employee_name: employee.name, date: dateStr, check_in: timeStr, status, late_minutes: lateMinutes, branch_id: (employee as any).branch_id, shift_id: schedule?.shift_id }]);
                setLastScanResult({ success: true, name: employee.name, time: timeStr, type: 'IN', status: status === 'Late' ? `Telat ${lateMinutes}m` : 'Selamat Bekerja!' });
            }
            setMode('RESULT');
            new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3').play().catch(() => {});
            setTimeout(() => resetKiosk(), 4000);
        } catch (err: any) { toast.error('Gagal: ' + err.message); resetKiosk(); } finally { setIsProcessing(false); processingRef.current = false; }
    };

    const findBestFingerprintMatch = (scanTemplate: string) => {
        const registeredEmployees = employeesRef.current.filter(e => e.fingerprint_template);
        if (registeredEmployees.length === 0) {
            return {
                employee: null,
                message: 'Belum ada data sidik jari karyawan yang terdaftar di database.'
            };
        }

        const matches = registeredEmployees
            .map(emp => ({
                emp,
                score: fingerprint.calculateBestSimilarity(emp.fingerprint_template!, scanTemplate),
                scanCount: emp.fingerprint_template!.split('|||').filter(Boolean).length
            }))
            .sort((a, b) => b.score - a.score);

        const bestMatch = matches[0];
        const secondBest = matches[1];

        if (bestMatch && bestMatch.scanCount < KIOSK_MIN_REGISTERED_SCANS) {
            return {
                employee: null,
                message: `Fingerprint ${bestMatch.emp.name} masih lemah (${bestMatch.scanCount} scan). Karyawan ini perlu daftar ulang minimal ${KIOSK_MIN_REGISTERED_SCANS} scan.`
            };
        }

        if (!bestMatch || bestMatch.score < KIOSK_FP_THRESHOLD) {
            if (bestMatch && bestMatch.score >= 4.0) {
                return {
                    employee: null,
                    message: `Jari hampir cocok dengan ${bestMatch.emp.name} (${bestMatch.score.toFixed(1)}%). Tekan lebih mantap pada sensor.`
                };
            }

            return {
                employee: null,
                message: bestMatch
                    ? `Sidik jari belum dikenali. Kecocokan tertinggi ${bestMatch.score.toFixed(1)}% dengan ${bestMatch.emp.name}, butuh minimal ${KIOSK_FP_THRESHOLD.toFixed(1)}%.`
                    : 'Sidik jari belum dikenali. Pastikan data fingerprint karyawan sudah terdaftar.'
            };
        }

        const gap = secondBest ? (bestMatch.score - secondBest.score) : 100;
        const isAmbiguous = !!secondBest &&
            bestMatch.score >= KIOSK_FP_AMBIGUITY_MIN &&
            gap < KIOSK_FP_AMBIGUITY_GAP &&
            bestMatch.score < 25;

        if (isAmbiguous) {
            return {
                employee: null,
                message: `Hasil ambigu antara ${bestMatch.emp.name} dan ${secondBest.emp.name}. Ulangi scan dengan posisi jari lebih pas.`
            };
        }

        return {
            employee: bestMatch.emp,
            message: `Cocok dengan ${bestMatch.emp.name} (${bestMatch.score.toFixed(1)}%)`
        };
    };

    const handleResetScanner = async () => {
        setFpStatus('Mereset Scanner...');
        await fingerprint.hardReset();
        resetKiosk();
        toast.success('Scanner fingerprint direset.');
    };

    useEffect(() => {
        if (mode !== 'SCANNING') { fingerprint.stopCapture(); return; }
        let isRunning = true;
        setFpStatus('Menghubungkan Scanner...');

        const callback = (status: string, result?: FingerprintResult) => {
            if (!isRunning || modeRef.current !== 'SCANNING') return;

            if (status === 'SUCCESS' && result?.success && result.template) {
                const matched = findBestFingerprintMatch(result.template);

                if (matched.employee) {
                    setFpStatus(`Cocok: ${matched.employee.name}`);
                    processAttendance(matched.employee);
                } else {
                    setFpStatus('Jari Tidak Cocok');
                    toast.error(matched.message, { duration: 4000 });
                    setTimeout(() => {
                        if (isRunning && modeRef.current === 'SCANNING') fingerprint.startCapture(callback, 'CAPTURE');
                    }, 1500);
                }
            } else if (status === 'ERROR') {
                setFpStatus(result?.message || 'Scanner Error');
            } else {
                const statusMap: Record<string, string> = {
                    'WAITING_FOR_FINGER': 'Tempel Jari...',
                    'ALAT_TERDETEKSI': 'Alat Terdeteksi',
                    'MENYIAPKAN_SCANNER': 'Menyiapkan Scanner...',
                    'MENYIAPKAN_ALAT': 'Menyiapkan Alat...',
                    'MENCARI_ALAT': 'Mencari Perangkat...',
                    'MEMULIHKAN_ALAT_SIBUK': 'Scanner Sibuk, Memulihkan...',
                    'SCANNER_INIT': 'Inisialisasi...'
                };
                setFpStatus(statusMap[status] || status);
            }
        };
        fingerprint.startCapture(callback, 'CAPTURE');
        return () => { isRunning = false; fingerprint.stopCapture(); };
    }, [mode, KIOSK_FP_THRESHOLD, KIOSK_FP_AMBIGUITY_GAP, KIOSK_FP_AMBIGUITY_MIN]);

    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

    const [lastScanResult, setLastScanResult] = useState<{ success: boolean; name: string; time: string; type: 'IN' | 'OUT'; status: string; } | null>(null);
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'Active').length;
    const registeredFingerprintCount = employees.filter(e => !!e.fingerprint_template).length;

    return (
        <div className="min-h-screen w-full bg-[#020617] text-white font-sans flex flex-col relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-blue-600/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-purple-600/5 blur-[120px] rounded-full"></div>
            </div>

            <header className="relative z-50 w-full max-w-6xl mx-auto px-8 py-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shadow-xl ring-1 ring-white/10">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight leading-none uppercase">Winny<span className="text-blue-500">Kiosk</span></h1>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Automated Attendance</p>
                    </div>
                </div>

                <div className="hidden md:flex flex-col items-end">
                    <div className="text-3xl font-black font-mono tracking-tighter leading-none">{currentTime.toLocaleTimeString('id-ID', { hour12: false })}</div>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                        <ClockIcon className="w-3 h-3" /> {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </div>
                </div>
                <button onClick={() => navigate('/')} className="md:hidden p-3 bg-white/5 border border-white/10 rounded-xl"><ArrowLeft className="w-5 h-5" /></button>
            </header>

            <main className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 px-8 pb-10 flex-1 overflow-hidden">
                <div className="flex-1 flex flex-col gap-6 h-full">
                    {/* Compact Hero Card */}
                    <div className="h-[480px] bg-white/[0.03] backdrop-blur-3xl border border-white/[0.08] rounded-[40px] p-8 md:p-12 flex flex-col items-center justify-center relative shadow-2xl ring-1 ring-white/5 overflow-hidden shrink-0">
                        
                        {mode === 'SCANNING' && (
                            <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center w-full max-w-md">
                                <div className="text-center space-y-3 mb-10">
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tight">Presensi <span className="text-white/40">Fingerprint</span></h2>
                                    <p className="text-slate-400 text-sm font-medium">Karyawan cukup tempel jari pada scanner USB U4500</p>
                                </div>

                                <div className="relative">
                                    <div className="w-48 h-48 rounded-full bg-blue-500/5 flex items-center justify-center border border-white/5 relative">
                                        <Fingerprint className="w-24 h-24 text-blue-500 animate-pulse" />
                                        <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 animate-scan-fast shadow-[0_0_20px_rgba(59,130,246,1)]"></div>
                                    </div>
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">{fpStatus}</div>
                                </div>

                                <div className="mt-12 w-full space-y-3">
                                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-4 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-300">Scanner Siap</p>
                                            <p className="text-sm text-slate-400 mt-1">
                                                {registeredFingerprintCount > 0
                                                    ? `${registeredFingerprintCount} dari ${totalEmployees} karyawan sudah punya data sidik jari.`
                                                    : 'Belum ada karyawan yang punya data sidik jari terdaftar.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total</p>
                                            <p className="text-xl font-black text-white mt-1">{totalEmployees}</p>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Aktif</p>
                                            <p className="text-xl font-black text-emerald-400 mt-1">{activeEmployees}</p>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">FP</p>
                                            <p className="text-xl font-black text-blue-400 mt-1">{registeredFingerprintCount}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleResetScanner}
                                        className="w-full py-4 bg-white/[0.04] hover:bg-white/[0.08] text-white rounded-[24px] font-black text-sm border border-white/10 transition-all flex items-center justify-center gap-3"
                                    >
                                        <RefreshCw className="w-4 h-4" /> RESET SCANNER
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'RESULT' && lastScanResult && (
                            <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center text-center">
                                <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 border-8 shadow-xl ${lastScanResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                    {lastScanResult.success ? <CheckCircle className="w-20 h-20" /> : <XCircle className="w-20 h-20" />}
                                </div>
                                <h2 className="text-5xl font-black mb-4 tracking-tighter">{lastScanResult.name}</h2>
                                <div className="flex items-center gap-4 mb-8">
                                    <span className="text-xl font-black uppercase tracking-widest px-6 py-2 bg-white/10 rounded-2xl">{lastScanResult.type}</span>
                                    <span className="text-2xl font-mono text-slate-400">{lastScanResult.time}</span>
                                </div>
                                <p className="text-3xl font-black text-white">{lastScanResult.status}</p>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="font-black text-xs tracking-widest uppercase text-blue-500">Mencatat...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Compact Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard icon={<Users className="w-5 h-5 text-blue-500"/>} label="Sched" value={todayStats.total} />
                        <StatCard icon={<UserCheck className="w-5 h-5 text-emerald-500"/>} label="Pres" value={todayStats.present} />
                        <StatCard icon={<ClockIcon className="w-5 h-5 text-orange-500"/>} label="Late" value={todayStats.late} />
                    </div>
                </div>

                {/* Slim Right Panel */}
                <div className="hidden lg:flex w-72 bg-white/[0.02] border border-white/[0.08] rounded-[40px] p-8 md:p-12 flex-col overflow-hidden h-[480px] shrink-0">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aktivitas</h3>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {logs.slice(0, 50).map((log, i) => (
                            <div key={log.id} className="bg-white/[0.03] p-4 rounded-3xl border border-white/[0.05] flex items-center gap-4 transition-all">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${log.check_out ? 'bg-blue-600/10 text-blue-400' : 'bg-emerald-600/10 text-emerald-400'}`}>
                                    {log.check_out ? <LogOut className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-black text-[12px] truncate uppercase tracking-tight">{log.employee_name}</p>
                                    <p className="text-[9px] font-mono text-slate-500 mt-0.5">{log.check_out || log.check_in}</p>
                                </div>
                                {log.status === 'Late' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title="Telat"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: number }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col relative group">
            <div className="flex items-center justify-between mb-2">
                <div className="opacity-60">{icon}</div>
                <div className="text-xl font-black font-mono">{value}</div>
            </div>
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</div>
        </div>
    );
}
