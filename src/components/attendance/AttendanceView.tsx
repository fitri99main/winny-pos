import { useState, useEffect, useRef } from 'react';
import { QrCode, History, Camera, UserCheck, XCircle, Search, Zap, Plus, X, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Employee } from '../employees/EmployeesView';

interface AttendanceLog {
    id: number;
    employeeName: string;
    checkIn: string;
    checkOut?: string;
    date: string;
    status: 'Present' | 'Late' | 'Off Day Work';
}

interface Shift {
    id: string;
    name: string;
    startTime: string;
}

const MOCK_SHIFTS: Shift[] = [
    { id: 's1', name: 'Shift Pagi', startTime: '07:00' },
    { id: 's2', name: 'Shift Sore', startTime: '15:00' },
];

const MOCK_SCHEDULES: Record<string, string> = {
    'EMP-1': 's1',
    'EMP-2': 's1',
    'EMP-3': 's2',
};

const DAYS_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function AttendanceView({ logs, setLogs, employees }: { logs: AttendanceLog[], setLogs: any, employees: Employee[] }) {
    const [tab, setTab] = useState<'scan' | 'history'>('scan');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const startCamera = async () => {
        try {
            if (streamRef.current) return;
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = mediaStream;
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setCameraActive(true);
                startScanning();
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast.error('Gagal mengakses kamera.');
            setIsCameraEnabled(false);
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        setCameraActive(false);
    };

    const startScanning = () => {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        if ('BarcodeDetector' in window) {
            const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            scanIntervalRef.current = setInterval(async () => {
                if (videoRef.current && cameraActive) {
                    try {
                        const barcodes = await barcodeDetector.detect(videoRef.current);
                        if (barcodes.length > 0) {
                            const code = barcodes[0].rawValue;
                            if (code && code !== scannedData) {
                                handleScan(code);
                            }
                        }
                    } catch (e) { }
                }
            }, 500);
        }
    };

    useEffect(() => {
        if (tab === 'scan' && isCameraEnabled) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [tab, isCameraEnabled]);

    const handleScan = (code: string) => {
        if (scannedData === code) return;

        // Code format is EMP-ID
        const empIdStr = code.replace('EMP-', '');
        const employee = employees.find(e => e.id.toString() === empIdStr);

        if (employee) {
            setScannedData(code);
            const today = new Date().toISOString().split('T')[0];
            const existingLog = logs.find(l => l.employeeName === employee.name && l.date === today);

            if (existingLog && !existingLog.checkOut) {
                setLogs(prev => prev.map(l => l.id === existingLog.id ? { ...l, checkOut: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) } : l));
                toast.success(`Check-Out Berhasil: ${employee.name}`);
            } else if (existingLog && existingLog.checkOut) {
                toast.info(`${employee.name} sudah selesai bekerja hari ini.`);
            } else {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const isOffDay = employee.offDays?.includes(dayOfWeek);

                const shiftId = MOCK_SCHEDULES[`EMP-${employee.id}`];
                const shift = MOCK_SHIFTS.find(s => s.id === shiftId);
                const checkInTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                let isLate = false;
                if (shift) {
                    const [sHour, sMin] = shift.startTime.split(':').map(Number);
                    if (now.getHours() > sHour || (now.getHours() === sHour && now.getMinutes() > sMin)) {
                        isLate = true;
                    }
                }

                const newLog: AttendanceLog = {
                    id: Date.now(),
                    employeeName: employee.name,
                    date: today,
                    checkIn: checkInTime,
                    status: isOffDay ? 'Off Day Work' : (isLate ? 'Late' : 'Present')
                };
                setLogs([newLog, ...logs]);

                if (isOffDay) {
                    toast.warning(`${employee.name} hadir di hari libur (Off Day: ${DAYS_NAME[dayOfWeek]})`);
                } else {
                    toast.success(`Check-In Berhasil: ${employee.name}`);
                }
            }
            setTimeout(() => setScannedData(null), 3000);
        } else {
            if (!scannedData) toast.error(`QR Code tidak dikenali: ${code}`);
        }
    };

    const handleManualAttendance = (employee: Employee) => {
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();
        const existingLog = logs.find(l => l.employeeName === employee.name && l.date === today);

        if (existingLog && !existingLog.checkOut) {
            setLogs(prev => prev.map(l => l.id === existingLog.id ? { ...l, checkOut: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) } : l));
            toast.success(`Check-Out Berhasil: ${employee.name}`);
        } else if (existingLog && existingLog.checkOut) {
            toast.info(`Sudah selesai bekerja hari ini.`);
        } else {
            const isOffDay = employee.offDays?.includes(dayOfWeek);
            const newLog: AttendanceLog = {
                id: Date.now(),
                employeeName: employee.name,
                date: today,
                checkIn: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                status: isOffDay ? 'Off Day Work' : 'Present'
            };
            setLogs([newLog, ...logs]);
            if (isOffDay) {
                toast.warning(`Absensi Manual: ${employee.name} masuk di hari libur.`);
            } else {
                toast.success(`Absensi Manual Berhasil: ${employee.name}`);
            }
        }
        setIsManualModalOpen(false);
    };

    const filteredLogs = logs.filter(log =>
        log.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (filterDate === '' || log.date === filterDate)
    );

    return (
        <div className="p-8 h-full bg-gray-50/50 flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Presensi & Jadwal</h2>
                    <p className="text-gray-500 font-medium">Monitoring kehadiran dan jadwal libur (Off Day).</p>
                </div>
                <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
                    <button onClick={() => setTab('scan')} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === 'scan' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Camera className="w-4 h-4" /> Scanner
                    </button>
                    <button onClick={() => setTab('history')} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <History className="w-4 h-4" /> Riwayat
                    </button>
                </div>
            </div>

            {tab === 'scan' ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-8">
                    <div className="relative w-full max-w-xl aspect-video bg-black rounded-[40px] overflow-hidden shadow-2xl border-8 border-white ring-1 ring-gray-200">
                        <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${cameraActive ? 'opacity-100' : 'opacity-0'}`} />
                        {!cameraActive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-50">
                                <QrCode className="w-16 h-16 mb-4 opacity-20" />
                                <Button onClick={() => setIsCameraEnabled(true)} className="h-12 rounded-2xl px-8 shadow-xl shadow-primary/20">Aktifkan Kamera Scanner</Button>
                            </div>
                        )}
                        {cameraActive && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-56 h-56 border-2 border-white/30 rounded-3xl relative">
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-1 -ml-1"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-1 -mr-1"></div>
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-1 -ml-1"></div>
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl -mb-1 -mr-1"></div>
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary/80 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan"></div>
                                </div>
                            </div>
                        )}
                        {scannedData && (
                            <div className="absolute inset-x-0 bottom-0 bg-emerald-600/90 backdrop-blur-md text-white p-6 text-center animate-in slide-in-from-bottom duration-300">
                                <UserCheck className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-lg font-black tracking-tight">{employees.find(e => `EMP-${e.id}` === scannedData)?.name}</p>
                                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Berhasil Dicatat</p>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <Button variant="outline" className="h-12 rounded-2xl px-8 border-dashed border-2 hover:bg-gray-50 font-bold text-gray-600" onClick={() => setIsManualModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Absensi Manual
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Cari nama karyawan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 text-sm bg-gray-50 border-none rounded-2xl outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-2xl border border-gray-200 shadow-inner">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Tanggal</span>
                            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent border-none outline-none text-sm font-bold text-gray-700" />
                        </div>
                    </div>

                    <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 text-left">
                                <tr>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Karyawan</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Tanggal</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Check-In</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Check-Out</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic font-medium">
                                            <div className="flex flex-col items-center gap-3">
                                                <History className="w-10 h-10 opacity-10" />
                                                <span>Tidak ada data absensi untuk periode ini.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => {
                                        const isOffDayWork = log.status === 'Off Day Work';
                                        return (
                                            <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="font-bold text-gray-800">{log.employeeName}</div>
                                                </td>
                                                <td className="px-8 py-5 text-gray-500 font-medium tracking-tight italic">{log.date}</td>
                                                <td className="px-8 py-5 font-black text-emerald-600">{log.checkIn}</td>
                                                <td className="px-8 py-5 font-black text-red-600">{log.checkOut || '--:--'}</td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ring-1 ${isOffDayWork ? 'bg-orange-50 text-orange-600 ring-orange-100' :
                                                            log.status === 'Late' ? 'bg-yellow-50 text-yellow-600 ring-yellow-100' :
                                                                'bg-emerald-50 text-emerald-600 ring-emerald-100'
                                                        }`}>
                                                        {isOffDayWork ? (
                                                            <span className="flex items-center gap-1 justify-center">
                                                                <AlertCircle className="w-3 h-3" /> Lembur (Off Day)
                                                            </span>
                                                        ) : (log.status === 'Late' ? 'Terlambat' : 'Hadir')}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isManualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-black text-gray-800">Absensi Manual</h3>
                                <p className="text-xs text-gray-500 font-medium">Pilih karyawan untuk dicatat kehadirannya.</p>
                            </div>
                            <button onClick={() => setIsManualModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-auto space-y-3">
                            {employees.map(emp => {
                                const dayOfWeek = new Date().getDay();
                                const isOffDay = emp.offDays?.includes(dayOfWeek);
                                return (
                                    <button
                                        key={emp.id}
                                        onClick={() => handleManualAttendance(emp)}
                                        className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all group ${isOffDay ? 'bg-red-50/30 border-red-100 hover:bg-red-50 hover:border-red-200' : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-primary/20'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-black text-gray-800 group-hover:text-primary transition-colors">{emp.name}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{emp.position}</div>
                                        </div>
                                        {isOffDay && (
                                            <span className="px-2 py-1 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-red-200">Hari Libur</span>
                                        )}
                                        {!isOffDay && <Plus className="w-5 h-5 text-gray-300 group-hover:text-primary" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="p-8 border-t border-gray-50 bg-gray-50/10 flex gap-3">
                            <Button variant="outline" className="flex-1 h-14 rounded-2xl" onClick={() => setIsManualModalOpen(false)}>Batal</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
