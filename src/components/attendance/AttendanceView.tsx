import { useState, useEffect, useRef } from 'react';
import { QrCode, History, Camera, UserCheck, XCircle, Search, Zap, Plus, X, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Employee } from '../employees/EmployeesView';
import { fingerprint, FingerprintResult } from '../../lib/fingerprint';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

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

export function AttendanceView({ logs, setLogs, employees, onLogAttendance, settings }: { logs: AttendanceLog[], setLogs: any, employees: Employee[], onLogAttendance?: (log: any) => Promise<void>, settings?: any }) {
    const [tab, setTab] = useState<'scan' | 'history'>('scan');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);

    // Fingerprint / HID State
    const [inputBuffer, setInputBuffer] = useState('');
    const lastInputTime = useRef<number>(0);
    const isFingerprintMode = settings?.enable_fingerprint || false;
    const hideCamera = settings?.hide_camera_scanner || false;

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
        if (tab === 'scan' && isCameraEnabled && !hideCamera) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [tab, isCameraEnabled, hideCamera]);

    const handleScan = (code: string) => {
        if (scannedData === code) return;

        // Lookup by Barcode first, then ID (fallback)
        const employee = employees.find(e =>
            e.barcode === code ||
            `EMP-${e.id}` === code ||
            e.id.toString() === code
        );

        if (employee) {
            setScannedData(code);
            const today = new Date().toISOString().split('T')[0];
            const existingLog = logs.find(l => l.employeeName === employee.name && l.date === today);

            if (existingLog && !existingLog.checkOut) {
                const checkOutTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                if (onLogAttendance) {
                    onLogAttendance({ ...existingLog, checkOut: checkOutTime, isNew: false });
                } else {
                    setLogs((prev: AttendanceLog[]) => prev.map(l => l.id === existingLog.id ? { ...l, checkOut: checkOutTime } : l));
                }
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

                if (onLogAttendance) {
                    onLogAttendance({ ...newLog, isNew: true });
                } else {
                    setLogs([newLog, ...logs]);
                }

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

    // USB Fingerprint Scanner SDK Effect
    const [fpError, setFpError] = useState<string | null>(null);
    const [fpStatus, setFpStatus] = useState<string>('Initializing...');
    const [retryCount, setRetryCount] = useState(0);
    const employeesRef = useRef(employees);

    // Update ref when employees change
    useEffect(() => {
        employeesRef.current = employees;
    }, [employees]);

    const handleFpRetry = () => {
        fingerprint.forceResetBusy();
        setRetryCount(prev => prev + 1);
    };

    useEffect(() => {
        if (tab !== 'scan' || !isFingerprintMode) {
            fingerprint.stopCapture();
            return;
        }

        let isRunning = true;
        setFpError(null);
        setFpStatus('Mencari Perangkat...');

        const calculateSimilarity = (str1: string, str2: string): number => {
            return fingerprint.calculateSimilarity(str1, str2);
        };

        const callback = (status: string, result?: FingerprintResult) => {
            if (!isRunning) return;

            if (status === 'SUCCESS' && result?.success && result.template) {
                setFpStatus('Sidik Jari Terdeteksi!');
                const currentEmployees = employeesRef.current;

                // Track all scores for calibration
                const matches = currentEmployees
                    .filter(e => e.fingerprint_template)
                    .map(emp => ({
                        emp,
                        score: calculateSimilarity(emp.fingerprint_template!, result.template!)
                    }))
                    .sort((a, b) => b.score - a.score);

                const bestMatch = matches[0];
                const secondBest = matches[1];
                const THRESHOLD = 10; // Slightly lower to accommodate noise

                console.log('Fp Match Profile:', matches.slice(0, 3).map(m => `${m.emp.name}: ${m.score.toFixed(1)}%`));

                // Detect boilerplate matching: if different people have exactly the same score
                const isNoiseFloor = secondBest && (Math.abs(bestMatch.score - secondBest.score) < 0.1) && bestMatch.score < 25;

                if (bestMatch && bestMatch.score >= THRESHOLD && !isNoiseFloor) {
                    handleScan(bestMatch.emp.barcode || `EMP-${bestMatch.emp.id}`);
                } else {
                    const errorSuffix = isNoiseFloor ? '(Banyak kemiripan terdeteksi - Noise)' : `(Skor: ${bestMatch?.score.toFixed(0) || 0}%)`;
                    toast.error(`Sidik jari tidak dikenali ${errorSuffix}.`);
                }

                // Restart capture after a short delay for next person
                setTimeout(() => {
                    if (isRunning && tab === 'scan' && isFingerprintMode) {
                        fingerprint.startCapture(callback, 'CAPTURE');
                    }
                }, 2000);
            } else if (status === 'ERROR') {
                console.error('Fingerprint Error:', result);
                let errorMessage = result?.message || 'Gagal terhubung ke scanner.';
                setFpError(errorMessage);
                setFpStatus('ERROR');
            } else {
                if (status === 'WAITING_FOR_FINGER') {
                    setFpStatus('Silakan Tempel Jari Anda');
                } else if (status === 'ALAT_TERDETEKSI') {
                    setFpStatus('Alat Terdeteksi! Menyiapkan...');
                } else {
                    setFpStatus(status);
                }
            }
        };

        fingerprint.startCapture(callback, 'CAPTURE');

        return () => {
            isRunning = false;
            fingerprint.stopCapture();
        };
    }, [tab, isFingerprintMode, retryCount]);

    // Keyboard Barcode Scanner Hook
    useBarcodeScanner({
        onScan: handleScan,
        enabled: tab === 'scan'
    });

    const handleManualAttendance = (employee: Employee) => {
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();
        const existingLog = logs.find(l => l.employeeName === employee.name && l.date === today);

        if (existingLog && !existingLog.checkOut) {
            const checkOutTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            if (onLogAttendance) {
                onLogAttendance({ ...existingLog, checkOut: checkOutTime, isNew: false });
            } else {
                setLogs((prev: AttendanceLog[]) => prev.map(l => l.id === existingLog.id ? { ...l, checkOut: checkOutTime } : l));
            }
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

            if (onLogAttendance) {
                onLogAttendance({ ...newLog, isNew: true });
            } else {
                setLogs([newLog, ...logs]);
            }
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
                    {!hideCamera && (
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
                                    <p className="text-lg font-black tracking-tight">{employees.find(e => e.barcode === scannedData || `EMP-${e.id}` === scannedData)?.name}</p>
                                    <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Berhasil Dicatat</p>
                                </div>
                            )}
                        </div>
                    )}

                    {isFingerprintMode && (
                        <div className={`w-full max-w-xl p-10 bg-white rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center gap-6 relative overflow-hidden ${hideCamera ? 'py-20' : ''}`}>
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500/10 overflow-hidden">
                                <div className="h-full bg-blue-500 animate-pulse w-full"></div>
                            </div>

                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center relative">
                                <Zap className="w-10 h-10 text-blue-600 animate-pulse" />
                                <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping opacity-20"></div>
                            </div>

                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-gray-800 tracking-tight">
                                    {fpError ? 'Gagal Inisialisasi Scanner' : (fpStatus === 'WAITING_FOR_FINGER' ? 'Scan Sidik Jari Ready' : 'Scanner Fingerprint Standby')}
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">
                                    {fpError || 'Tempelkan jari Anda pada alat scanner untuk absensi.'}
                                </p>
                                {fpStatus !== 'ERROR' && !fpError && (
                                    <div className="mt-2 text-[10px] text-blue-400 font-mono opacity-60">
                                        Status: {fpStatus}
                                    </div>
                                )}
                            </div>

                            {fpError && (
                                <div className="mt-4 p-5 bg-red-50/50 border border-red-100 rounded-[32px] w-full max-w-xs animate-in fade-in zoom-in-95 duration-500">
                                    <div className="flex items-center gap-2 text-red-600 mb-2 justify-center">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="font-bold text-[11px] uppercase tracking-wider">Bantuan Diagnosa</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mb-4 leading-relaxed text-center font-medium">
                                        Jika menggunakan HTTPS, Anda perlu memberikan izin akses manual ke service lokal Browser.
                                    </p>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-2">
                                            {fingerprint.getServiceUrls().map((svc) => (
                                                <a
                                                    key={svc.port}
                                                    href={svc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between px-4 py-2 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all group shadow-sm"
                                                >
                                                    <span className="text-[10px] font-black text-gray-500">
                                                        CHECK {svc.protocol} PORT {svc.port}
                                                    </span>
                                                    <ExternalLink className="w-3 h-3 text-red-400 group-hover:text-red-600 transition-colors" />
                                                </a>
                                            ))}
                                        </div>

                                        {/* Service Restoration Guide */}
                                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                            <p className="text-[10px] text-blue-700 font-black uppercase tracking-wider mb-2">
                                                Layanan Tidak Ditemukan?
                                            </p>
                                            <p className="text-[9px] text-blue-600 leading-relaxed mb-3">
                                                Jika link "CHECK" di atas bertuliskan <b>Refused to connect</b>, service tidak berjalan.
                                            </p>
                                            <ol className="text-[9px] text-gray-500 list-decimal list-inside space-y-1.5 font-medium">
                                                <li>Buka <b>C:\Program Files\DigitalPersona\Bin</b></li>
                                                <li>Cari file <b>DpHost.exe</b></li>
                                                <li>Klik kanan & pilih <b>Run as Administrator</b></li>
                                                <li>Cek kembali <b>services.msc</b></li>
                                            </ol>
                                        </div>

                                        <div className="bg-white/50 p-3 rounded-2xl border border-dashed border-red-200">
                                            <p className="text-[9px] text-red-500 font-bold leading-tight">
                                                Langkah Protokol (HTTPS):
                                            </p>
                                            <ol className="text-[8px] text-gray-400 list-decimal list-inside mt-1 space-y-0.5">
                                                <li>Klik link port di atas</li>
                                                <li>Pilih "Lanjutkan/Advanced" jika ada peringatan privasi</li>
                                                <li>Tutup tab tersebut after loading</li>
                                                <li>Klik tombol Reset di bawah</li>
                                            </ol>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleFpRetry}
                                        className="w-full mt-4 h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-bold"
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Reset & Coba Lagi
                                    </Button>
                                </div>
                            )}

                            {scannedData && isFingerprintMode && (
                                <div className="flex items-center gap-3 px-6 py-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 animate-in zoom-in-95 duration-200">
                                    <UserCheck className="w-5 h-5" />
                                    <span className="font-bold text-sm">{employees.find(e => e.barcode === scannedData || `EMP-${e.id}` === scannedData)?.name}</span>
                                    <span className="text-[10px] font-black uppercase opacity-60">Berhasil</span>
                                </div>
                            )}
                        </div>
                    )}
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
