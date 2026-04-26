import { useState, useEffect, useRef } from 'react';
import { 
    QrCode, History, Camera, UserCheck, XCircle, Search, Zap, Plus, X, 
    AlertCircle, RefreshCw, ExternalLink, Clock, Download, FileText, FileSpreadsheet, Users,
    CheckCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Employee } from '../employees/EmployeesView';
import { fingerprint, FingerprintResult } from '../../lib/fingerprint';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface AttendanceLog {
    id: number;
    employee_id?: number;
    employeeName: string;
    checkIn: string;
    checkOut?: string;
    date: string;
    status: 'Present' | 'Late' | 'Off Day Work';
    branchName?: string;
    shift_id?: number;
    late_minutes?: number;
    overtime_minutes?: number;
    duration_minutes?: number;
}

export interface Shift {
    id: any;
    name: string;
    start_time: string;
    end_time: string;
    color?: string;
}

const DAYS_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function AttendanceView({ 
    logs, 
    setLogs, 
    employees, 
    onLogAttendance, 
    onRefresh,
    settings,
    userRole,
    dbInfo,
    branchId,
    shifts = [],
    schedules = []
}: { 
    logs: AttendanceLog[], 
    setLogs: any, 
    employees: Employee[], 
    onLogAttendance?: (log: any, action?: 'create' | 'update' | 'delete') => Promise<void>, 
    onRefresh?: () => Promise<void>,
    settings?: any,
    userRole?: string,
    dbInfo?: { url: string; error?: string | null },
    branchId?: string,
    shifts?: Shift[],
    schedules?: any[]
}) {
    const isAtleastAdmin = userRole?.toLowerCase() === 'administrator' || userRole?.toLowerCase() === 'owner';
    const [tab, setTab] = useState<'scan' | 'history'>('scan');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; // Start of month
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isAddHistoryModalOpen, setIsAddHistoryModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
    const [showAllHistory, setShowAllHistory] = useState(false); 
    const [isPrecisionMode, setIsPrecisionMode] = useState(true); // Default to true for better accuracy
    const [pendingFpEmployee, setPendingFpEmployee] = useState<Employee | null>(null);
    const [fpTimeout, setFpTimeout] = useState<number>(0);
    const [showFpDiagnostic, setShowFpDiagnostic] = useState(false);
    const fpTimeoutRef = useRef<any>(null);

    // Fingerprint / HID State
    const [inputBuffer, setInputBuffer] = useState('');
    const lastInputTime = useRef<number>(0);
    const isFingerprintMode = settings?.enable_fingerprint || false;
    const hideCamera = settings?.hide_camera_scanner || false;

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<any>(null);

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

    // Helper for actual log logic (Share across QR and FP)
    const processAttendance = async (employee: Employee) => {
        const now = new Date();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const existingLog = logs.find(l => (String(l.employee_id) === String(employee.id) || l.employeeName === employee.name) && l.date === localDate);

        // Find schedule for today
        const schedule = schedules.find(s => String(s.employee_id) === String(employee.id) && s.date === localDate);
        const shift = schedule ? shifts.find(sh => String(sh.id) === String(schedule.shift_id)) : null;

        if (existingLog && !existingLog.checkOut) {
            const checkOutTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            
            // Calculate Overtime and Duration
            let overtimeMinutes = 0;
            let durationMinutes = 0;

            const [inH, inM] = existingLog.checkIn.split(':').map(Number);
            const inDate = new Date(now);
            inDate.setHours(inH, inM, 0, 0);
            durationMinutes = Math.round((now.getTime() - inDate.getTime()) / (1000 * 60));

            // Determine effective shift times (Manual Override > Master Shift)
            const effectiveEndTime = schedule?.custom_end_time || shift?.end_time;

            if (effectiveEndTime) {
                const [endH, endM] = effectiveEndTime.split(':').map(Number);
                const shiftEndDate = new Date(now);
                shiftEndDate.setHours(endH, endM, 0, 0);
                
                if (now > shiftEndDate) {
                    overtimeMinutes = Math.round((now.getTime() - shiftEndDate.getTime()) / (1000 * 60));
                }
            }

            if (onLogAttendance) {
                await onLogAttendance({ 
                    ...existingLog, 
                    checkOut: checkOutTime, 
                    overtime_minutes: overtimeMinutes,
                    duration_minutes: durationMinutes,
                    isNew: false 
                }, 'update');
            } else {
                setLogs((prev: AttendanceLog[]) => prev.map(l => l.id === existingLog.id ? { 
                    ...l, 
                    checkOut: checkOutTime,
                    overtime_minutes: overtimeMinutes,
                    duration_minutes: durationMinutes
                } : l));
            }
            toast.success(`Check-Out Berhasil: ${employee.name}${overtimeMinutes > 0 ? ` (Lembur: ${overtimeMinutes}m)` : ''}`);
        } else if (existingLog && existingLog.checkOut) {
            toast.info(`${employee.name} sudah selesai bekerja hari ini.`);
        } else {
            const dayOfWeek = now.getDay();
            const isOffDay = employee.offDays?.includes(dayOfWeek);
            const checkInTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            let isLate = false;
            let lateMinutes = 0;

            // Determine effective shift times (Manual Override > Master Shift)
            const effectiveStartTime = schedule?.custom_start_time || shift?.start_time;

            if (effectiveStartTime) {
                const [sHour, sMin] = effectiveStartTime.split(':').map(Number);
                const shiftStartDate = new Date(now);
                shiftStartDate.setHours(sHour, sMin, 0, 0);

                if (now > shiftStartDate) {
                    isLate = true;
                    lateMinutes = Math.round((now.getTime() - shiftStartDate.getTime()) / (1000 * 60));
                }
            }
            const newLog: AttendanceLog = {
                id: Date.now(),
                employee_id: Number(employee.id),
                employeeName: employee.name,
                date: localDate,
                checkIn: checkInTime,
                shift_id: shift ? Number(shift.id) : undefined,
                late_minutes: lateMinutes,
                status: isOffDay ? 'Off Day Work' : (isLate ? 'Late' : 'Present')
            };

            if (onLogAttendance) {
                await onLogAttendance({ ...newLog, isNew: true }, 'create');
            } else {
                setLogs([newLog, ...logs]);
            }

            if (isOffDay) {
                toast.warning(`${employee.name} hadir di hari libur (Off Day: ${DAYS_NAME[dayOfWeek]})`);
            } else {
                if (isLate) {
                    toast.error(`Terlambat: ${employee.name} terlambat ${lateMinutes} menit.`);
                } else {
                    toast.success(`Check-In Berhasil: ${employee.name}`);
                }
            }
        }
        setScannedData(employee.barcode || `EMP-${employee.id}`);
        setTimeout(() => setScannedData(null), 3000);
    };

    const handleScan = async (code: string) => {
        if (scannedData === code && !pendingFpEmployee) return;

        // Reset pending if scanned again
        if (fpTimeoutRef.current) {
            clearTimeout(fpTimeoutRef.current);
            fpTimeoutRef.current = null;
        }
        if (scannedData === code) return;

        // Lookup by Barcode first, then ID (fallback)
        const employee = employees.find(e =>
            e.barcode === code ||
            `EMP-${e.id}` === code ||
            e.id.toString() === code
        );

        if (employee) {
            // STEP 1: Check if we need Fingerprint Verification
            if (isFingerprintMode && isPrecisionMode && employee.fingerprint_template) {
                setPendingFpEmployee(employee);
                setFpTimeout(15); 
                
                fpTimeoutRef.current = setInterval(() => {
                    setFpTimeout(prev => {
                        if (prev <= 1) {
                            if (fpTimeoutRef.current) clearInterval(fpTimeoutRef.current);
                            setPendingFpEmployee(null);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
                
                toast.info(`Silakan tempelkan jari Anda, ${employee.name}`);
                return;
            }

            await processAttendance(employee);
        } else {
            if (!scannedData) toast.error(`ID/QR Code tidak dikenali: ${code}`);
        }
    };

    // USB Fingerprint Scanner SDK Effect
    const [fpError, setFpError] = useState<string | null>(null);
    const [fpStatus, setFpStatus] = useState<string>('Initializing...');
    const [retryCount, setRetryCount] = useState(0);
    const employeesRef = useRef(employees);
    const pendingRef = useRef(pendingFpEmployee);
    const isPrecisionRef = useRef(isPrecisionMode);

    // Update refs
    useEffect(() => {
        employeesRef.current = employees;
        pendingRef.current = pendingFpEmployee;
        isPrecisionRef.current = isPrecisionMode;
    }, [employees, pendingFpEmployee, isPrecisionMode]);

    const handleFpRetry = () => {
        fingerprint.hardReset();
        setRetryCount(prev => prev + 1);
    };

    useEffect(() => {
        if (tab !== 'scan' || !isFingerprintMode) {
            fingerprint.stopCapture();
            return;
        }

        let isRunning = true;
        setFpStatus('Menghubungkan Alat...');
        
        let isRunningSync = true;
        
        const callback = (status: string, result?: FingerprintResult) => {
            if (!isRunning || !isRunningSync) return;

            if (status === 'SUCCESS' && result?.success && result.template) {
                // ... (existing success logic)
                setFpStatus('Sidik Jari Terdeteksi!');
                const currentEmployees = employeesRef.current;
                const currentPending = pendingRef.current;

                // 1:1 Precision Mode Logic
                if (isPrecisionRef.current && currentPending) {
                    const score = fingerprint.calculateBestSimilarity(currentPending.fingerprint_template!, result.template!);
                    console.log(`[Fp 1:1] Target: ${currentPending.name}, Score: ${score.toFixed(1)}%`);
                    
                    if (score >= 12.0) {
                        handleScan(currentPending.barcode || `EMP-${currentPending.id}`);
                        setPendingFpEmployee(null);
                    } else {
                        toast.error(`Verifikasi Gagal: Jari tidak cocok. (Skor: ${score.toFixed(1)}%)`);
                    }
                } else {
                    // 1:N Quick Mode Logic
                    const matches = currentEmployees
                        .filter(e => e.fingerprint_template)
                        .map(emp => ({
                            emp,
                            score: fingerprint.calculateBestSimilarity(emp.fingerprint_template!, result.template!)
                        }))
                        .sort((a, b) => b.score - a.score);

                    const bestMatch = matches[0];
                    const secondBest = matches[1];
                    // REDUCED THRESHOLD: 9.5% (was 12.0%) for better balance of recall vs precision
                    const THRESHOLD = 9.5; 
                    const AMBIGUITY_SCORE_MIN = 4.5;

                    const gap = secondBest ? (bestMatch.score - secondBest.score) : 100;
                    const isAmbiguous = bestMatch && secondBest && 
                                      bestMatch.score >= AMBIGUITY_SCORE_MIN && 
                                      gap < 0.5 && 
                                      bestMatch.score < 25;
                    
                    if (bestMatch && bestMatch.score >= THRESHOLD && !isAmbiguous) {
                        handleScan(bestMatch.emp.barcode || `EMP-${bestMatch.emp.id}`);
                    } else {
                        let errorMsg = '';
                        if (isAmbiguous) {
                            errorMsg = `Ambigu: Kemiripan tinggi dengan ${bestMatch.emp.name} & ${secondBest.emp.name}. Gunakan kartu ID.`;
                        } else if (bestMatch && bestMatch.score > 0) {
                            if (bestMatch.score >= 4.0 && bestMatch.score < THRESHOLD) {
                                errorMsg = `Jari Hampir Cocok (${bestMatch.score.toFixed(1)}%). Mohon tekan lebih mantap pada sensor.`;
                            } else {
                                errorMsg = `Jari Tidak Dikenali (Skor ${bestMatch.score.toFixed(1)}% - Butuh ${THRESHOLD.toFixed(1)}%).`;
                            }
                        } else {
                            errorMsg = 'Sidik Jari Tidak Terdaftar. Silakan Daftar Ulang 3-Tahap.';
                        }
                        toast.error(`Absensi Gagal: ${errorMsg}`, { duration: 5000 });
                    }
                }

                // Restart capture
                setTimeout(() => {
                    if (isRunning && isRunningSync && tab === 'scan' && isFingerprintMode) {
                        fingerprint.startCapture(callback, 'CAPTURE');
                    }
                }, 2000);
            } else if (status === 'ERROR') {
                console.error('Fingerprint Error:', result);
                const msg = result?.message || 'Gagal terhubung ke scanner.';
                setFpError(msg);
                setFpStatus('ERROR');

                // Auto-show diagnostic for persistent busy errors
                if (msg.includes('80070057') || msg.toLowerCase().includes('sibuk')) {
                    setShowFpDiagnostic(true);
                }
            } else {
                // Human-friendly status mapping
                const statusMap: Record<string, string> = {
                    'WAITING_FOR_FINGER': 'Silakan Tempel Jari Anda',
                    'ALAT_TERDETEKSI': 'Alat Terdeteksi! Menyiapkan...',
                    'MENYIAPKAN_SCANNER': 'Menghubungkan ke Scanner...',
                    'MENYIAPKAN_ALAT': 'Menyiapkan Alat...',
                    'MENCARI_ALAT': 'Mencari Perangkat...',
                    'MEMULIHKAN_ALAT_SIBUK': 'Hardware Sibuk: Memulihkan... (Mohon Tunggu)',
                    'SCANNER_INIT': 'Inisialisasi...'
                };
                setFpStatus(statusMap[status] || status);
            }
        };

        const startOperation = () => {
            if (isRunning && isRunningSync) {
                fingerprint.startCapture(callback, 'CAPTURE');
            }
        };

        const stopOperation = () => {
            isRunningSync = false;
            fingerprint.stopCapture();
        };

        // Handle Tab Visibility (Release hardware when tab hidden)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log('[Attendance] Tab hidden, releasing scanner...');
                stopOperation();
            } else {
                console.log('[Attendance] Tab visible, re-acquiring scanner...');
                isRunningSync = true;
                startOperation();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        startOperation();

        return () => {
            isRunning = false;
            isRunningSync = false;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            fingerprint.stopCapture();
        };
    }, [tab, isFingerprintMode, retryCount]);

    const handleResetHardware = async () => {
        setFpStatus('MERESET_ALAT');
        setFpError(null);
        setShowFpDiagnostic(false);
        await fingerprint.hardReset();
        // Wait for hardware to truly settle
        await new Promise(r => setTimeout(r, 1000));
        setRetryCount(prev => prev + 1); // Trigger re-effect
        toast.success('Hardware scanner direset. Silakan tempel jari lagi.');
    };

    // Keyboard Barcode Scanner Hook
    useBarcodeScanner({
        onScan: handleScan,
        enabled: tab === 'scan'
    });

    const handleManualAttendance = async (employee: Employee) => {
        await processAttendance(employee);
        setIsManualModalOpen(false);
    };

    const handleDeleteLog = async (log: AttendanceLog) => {
        if (!confirm(`Hapus riwayat absen ${log.employeeName} pada ${log.date}?`)) return;
        if (onLogAttendance) {
            await onLogAttendance(log, 'delete');
        } else {
            setLogs(logs.filter(l => l.id !== log.id));
            toast.success('Log dihapus');
        }
    };

    const filteredLogs = logs.filter(log => {
        if (showAllHistory) return true;
        const matchesSearch = log.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDateRange = (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate);
        return matchesSearch && matchesDateRange;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const exportToExcel = () => {
        try {
            const dataToExport = filteredLogs.map(log => ({
                'Karyawan': log.employeeName,
                'Cabang': log.branchName || '-',
                'Tanggal': log.date,
                'Masuk': log.checkIn,
                'Pulang': log.checkOut || '-',
                'Durasi (Menit)': log.duration_minutes || 0,
                'Lembur (Menit)': log.overtime_minutes || 0,
                'Telat (Menit)': log.late_minutes || 0,
                'Status': log.status
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
            
            XLSX.writeFile(wb, `Laporan_Absensi_${startDate}_to_${endDate}.xlsx`);
            toast.success('Laporan Excel berhasil diunduh');
        } catch (error) {
            console.error('Export Excel failed:', error);
            toast.error('Gagal mengekspor Excel');
        }
    };

    const exportToPDF = () => {
        try {
            const doc = new jsPDF();
            
            // Header
            doc.setFontSize(18);
            doc.text('Laporan Rekapitulasi Absensi', 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 30);
            doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 36);

            const tableData = filteredLogs.map(log => [
                log.employeeName,
                log.date,
                log.checkIn,
                log.checkOut || '-',
                log.duration_minutes ? `${Math.floor(log.duration_minutes/60)}j ${log.duration_minutes%60}m` : '-',
                log.late_minutes || 0,
                log.overtime_minutes || 0,
                log.status
            ]);

            autoTable(doc, {
                startY: 45,
                head: [['Nama Staff', 'Tanggal', 'Masuk', 'Pulang', 'Durasi', 'Telat', 'OT', 'Status']],
                body: tableData as any,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246], textColor: 255 },
                styles: { fontSize: 8 },
                columnStyles: { 0: { cellWidth: 40 } }
            });

            doc.save(`Laporan_Absensi_${startDate}_to_${endDate}.pdf`);
            toast.success('Laporan PDF berhasil diunduh');
        } catch (error) {
            console.error('Export PDF failed:', error);
            toast.error('Gagal mengekspor PDF');
        }
    };

    return (
        <div className="p-8 h-full bg-gray-50/50 flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Presensi & Jadwal</h2>
                    <p className="text-gray-500 font-medium">Monitoring kehadiran dan jadwal libur (Off Day).</p>
                </div>
                <div className="flex items-center gap-4">
                    {tab === 'scan' && isFingerprintMode && (
                        <div className="flex items-center bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
                            <button 
                                onClick={() => setIsPrecisionMode(true)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPrecisionMode ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Presisi (QR+Jari)
                            </button>
                            <button 
                                onClick={() => {
                                    setIsPrecisionMode(false);
                                    setPendingFpEmployee(null);
                                }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isPrecisionMode ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Cepat (Jari)
                            </button>
                        </div>
                    )}
                    <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
                        <button onClick={() => setTab('scan')} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === 'scan' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <Camera className="w-4 h-4" /> Scanner
                        </button>
                        <button onClick={() => setTab('history')} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <History className="w-4 h-4" /> Riwayat
                        </button>
                    </div>
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
                            {scannedData && !pendingFpEmployee && (
                                <div className="absolute inset-x-0 bottom-0 bg-emerald-600/90 backdrop-blur-md text-white p-6 text-center animate-in slide-in-from-bottom duration-300">
                                    <UserCheck className="w-8 h-8 mx-auto mb-2" />
                                    <p className="text-lg font-black tracking-tight">{employees.find(e => e.barcode === scannedData || `EMP-${e.id}` === scannedData)?.name}</p>
                                    <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Berhasil Dicatat</p>
                                </div>
                            )}
                        </div>
                    )}

                    {isFingerprintMode && (
                        <div className={`w-full max-w-xl p-10 bg-white rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center gap-6 relative overflow-hidden transition-all duration-500 ${hideCamera ? 'py-20' : ''} ${pendingFpEmployee ? 'ring-4 ring-blue-500/20 bg-blue-50/10' : ''}`}>
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500/10 overflow-hidden">
                                <div className={`h-full bg-blue-500 transition-all duration-300 ${pendingFpEmployee ? 'w-full animate-none' : 'animate-pulse w-full'}`} style={pendingFpEmployee ? { width: `${(fpTimeout/15)*100}%` } : {}}></div>
                            </div>
                            
                            {pendingFpEmployee && (
                                <button 
                                    onClick={() => setPendingFpEmployee(null)}
                                    className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}

                            <div className={`w-24 h-24 rounded-full flex items-center justify-center relative transition-all duration-500 ${pendingFpEmployee ? 'bg-blue-600 scale-110 shadow-xl shadow-blue-500/30' : 'bg-blue-50'}`}>
                                <Zap className={`w-10 h-10 transition-colors ${pendingFpEmployee ? 'text-white translate-y-0' : 'text-blue-600 animate-pulse'}`} />
                                {!pendingFpEmployee && (
                                    <div className="absolute inset-0 rounded-full border-2 border-blue-200 animate-ping opacity-20"></div>
                                )}
                            </div>

                            <div className="text-center space-y-2">
                                {pendingFpEmployee ? (
                                    <>
                                        <h3 className="text-2xl font-black text-blue-900 tracking-tight animate-in zoom-in duration-300">
                                            Halo, {pendingFpEmployee.name}
                                        </h3>
                                        <p className="text-sm text-blue-600 font-bold uppercase tracking-widest">
                                            Silakan tempel jari Anda ({fpTimeout}s)
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="text-xl font-black text-gray-800 tracking-tight">
                                            {fpError ? 'Gagal Inisialisasi Scanner' : (isPrecisionMode ? 'Inisialisasi Scan: Barcode/QR Dulu' : 'Mode Cepat: Tempel Jari Ready')}
                                        </h3>
                                        <p className="text-sm text-gray-500 font-medium">
                                            {fpError || (isPrecisionMode ? 'Gunakan kartu ID atau scan HP Anda untuk memulai.' : 'Tempelkan jari anda langsung pada alat.')}
                                        </p>
                                    </>
                                )}
                                {fpStatus !== 'ERROR' && !fpError && !pendingFpEmployee && (
                                    <div className="mt-2 text-[10px] text-blue-400 font-mono opacity-60">
                                        Status: {fpStatus}
                                    </div>
                                )}

                                <div className="mt-4 flex flex-col gap-3 items-center">
                                    {fpError && (
                                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-center w-full max-w-xs animate-in slide-in-from-top-1">
                                            <p className="text-[11px] font-bold text-red-600 mb-2 leading-relaxed tracking-tight">{fpError}</p>
                                            <button 
                                                onClick={handleResetHardware}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-red-200"
                                            >
                                                <RefreshCw className="w-3 h-3" /> Reset Alat Sekarang
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleResetHardware}
                                            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-gray-100 shadow-sm"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Force Reset
                                        </button>
                                        {!showFpDiagnostic && (
                                            <button 
                                                onClick={() => setShowFpDiagnostic(true)}
                                                className="px-4 py-2 bg-white hover:bg-gray-50 text-blue-400 hover:text-blue-600 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-blue-50 shadow-sm"
                                            >
                                                <AlertCircle className="w-3.5 h-3.5" /> Bantuan?
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {showFpDiagnostic && (
                                <div className="mt-4 p-6 bg-blue-50/50 border border-blue-100 rounded-[32px] w-full max-w-md animate-in zoom-in duration-300 relative">
                                    <button 
                                        onClick={() => setShowFpDiagnostic(false)}
                                        className="absolute top-4 right-4 text-blue-400 hover:text-blue-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-2 text-blue-600 mb-4 justify-center">
                                        <Zap className="w-4 h-4" />
                                        <span className="font-black text-[11px] uppercase tracking-widest">Solusi Hardware Sibuk</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex gap-3 bg-white/80 p-3 rounded-2xl border border-blue-100/50 shadow-sm">
                                            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-[10px]">1</div>
                                            <p className="text-[11px] font-bold text-blue-900 leading-tight">Cabut dan pasang kembali kabel USB alat fingerprint.</p>
                                        </div>
                                        <div className="flex gap-3 bg-white/80 p-3 rounded-2xl border border-blue-100/50 shadow-sm">
                                            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-[10px]">2</div>
                                            <p className="text-[11px] font-bold text-blue-900 leading-tight">Tutup tab Chrome lain yang mungkin menggunakan fingerprint.</p>
                                        </div>
                                        <div className="flex gap-3 bg-white/80 p-3 rounded-2xl border border-blue-100/50 shadow-sm">
                                            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-[10px]">3</div>
                                            <p className="text-[11px] font-bold text-blue-900 leading-tight italic">Terakhir: Restart "DigitalPersona Biometric Service" di Windows Services (services.msc).</p>
                                        </div>
                                        
                                        <div className="pt-2 grid grid-cols-1 gap-2">
                                            {fingerprint.getServiceUrls().slice(0, 2).map((svc) => (
                                                <a
                                                    key={svc.port}
                                                    href={svc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between px-4 py-2 bg-white border border-blue-100 rounded-2xl hover:bg-blue-50 transition-all group shadow-sm text-[9px] font-black text-blue-500 uppercase"
                                                >
                                                    Cek Koneksi Port {svc.port}
                                                    <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-blue-600" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
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
                    {/* Summary Widgets */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {(() => {
                            const now = new Date();
                            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                            const todayLogs = logs.filter(l => l.date === today);
                            const todaySchedules = schedules.filter(s => s.date === today);
                            
                            const presentCount = todayLogs.length;
                            const lateCount = todayLogs.filter(l => l.status === 'Late').length;
                            const topupCount = todayLogs.filter(l => (l.overtime_minutes || 0) > 0).length;
                            
                            const absentEmployees = todaySchedules.filter(s => 
                                !todayLogs.some(l => String(l.employee_id) === String(s.employee_id) || l.employeeName === s.employee_name)
                            );

                            return (
                                <>
                                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-600 flex items-center justify-center">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest uppercase">Total Karyawan</div>
                                            <div className="text-2xl font-black text-gray-800">{employees.length}</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <UserCheck className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest uppercase">Hadir Hari Ini</div>
                                            <div className="text-2xl font-black text-gray-800">{presentCount} <span className="text-xs text-gray-400">/ {todaySchedules.length}</span></div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                                            <XCircle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest uppercase">Tidak Masuk</div>
                                            <div className="text-2xl font-black text-rose-600">{absentEmployees.length}</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest uppercase">Terlambat</div>
                                            <div className="text-2xl font-black text-orange-600">{lateCount}</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                            <Zap className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest uppercase">Lembur</div>
                                            <div className="text-2xl font-black text-blue-600">{topupCount}</div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* NEW: Today's Scheduled Staff List */}
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Jadwal Staff Hari Ini</h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Monitoring Kehadiran Real-time</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            {(() => {
                                const now = new Date();
                                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                const todaySchedules = schedules.filter(s => s.date === todayStr);
                                const todayLogs = logs.filter(l => l.date === todayStr);

                                if (todaySchedules.length === 0) {
                                    return (
                                        <div className="w-full py-10 text-center border-2 border-dashed border-gray-100 rounded-[32px] flex flex-col items-center gap-2">
                                            <Users className="w-10 h-10 text-gray-200" />
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tidak ada jadwal diatur hari ini</p>
                                        </div>
                                    );
                                }

                                return todaySchedules.map(sched => {
                                    const log = todayLogs.find(l => String(l.employee_id) === String(sched.employee_id) || l.employeeName === (sched as any).employee_name);
                                    const shift = shifts.find(s => String(s.id) === String(sched.shift_id));
                                    const startTime = sched.custom_start_time || shift?.start_time || '--:--';
                                    const endTime = sched.custom_end_time || shift?.end_time || '--:--';

                                    return (
                                        <div key={sched.id} className="bg-gray-50/50 border border-gray-100 p-4 rounded-3xl min-w-[200px] flex-1 flex flex-col gap-3 group hover:border-primary/20 transition-all">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-black text-gray-800 text-sm group-hover:text-primary transition-colors">{(sched as any).employee_name}</div>
                                                    <div className="text-[9px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-1 mt-0.5">
                                                        <Zap className="w-3 h-3" /> {shift?.name || 'Custom Shift'}
                                                    </div>
                                                </div>
                                                {log ? (
                                                    <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-lg bg-gray-200 text-gray-400 flex items-center justify-center">
                                                        <Clock className="w-3.5 h-3.5" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-gray-100/50">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase">Shift Time</span>
                                                    <span className="text-[10px] font-black font-mono text-gray-700">{startTime} - {endTime}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase">Status</span>
                                                    {log ? (
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase">Hadir {log.checkIn}</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-orange-500 uppercase italic">Belum Hadir</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                        <div className="flex-1 min-w-[200px] space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cari Karyawan</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Ketik nama staff..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 items-end">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dari Tanggal</label>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sampai Tanggal</label>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                            <input 
                                type="checkbox" 
                                id="showAll" 
                                checked={showAllHistory} 
                                onChange={(e) => setShowAllHistory(e.target.checked)}
                                className="w-4 h-4 accent-primary"
                            />
                            <label htmlFor="showAll" className="text-[10px] font-black text-blue-600 uppercase cursor-pointer select-none">Semua</label>
                        </div>
                        
                        <div className="flex gap-2 ml-auto">
                            <button 
                                onClick={exportToExcel}
                                title="Ekspor ke Excel"
                                className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100 flex items-center gap-2 group"
                            >
                                <FileSpreadsheet className="w-5 h-5" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">Excel</span>
                            </button>
                            <button 
                                onClick={exportToPDF}
                                title="Unduh PDF"
                                className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all active:scale-95 border border-red-100 flex items-center gap-2 group"
                            >
                                <FileText className="w-5 h-5" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">PDF</span>
                            </button>
                            {isAtleastAdmin && (
                                <button 
                                    onClick={() => setIsAddHistoryModalOpen(true)}
                                    className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Input Manual
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 text-left">
                                <tr>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Karyawan</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Cabang</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Tanggal</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Masuk / Pulang</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Durasi / OT</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-center">Status</th>
                                    {isAtleastAdmin && <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Aksi</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-8 py-20 text-center text-gray-400 italic font-medium">
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
                                                <td className="px-8 py-5">
                                                    <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg inline-block uppercase">{log.branchName || '-'}</div>
                                                </td>
                                                <td className="px-8 py-5 text-gray-500 font-medium tracking-tight italic">{log.date}</td>
                                                <td className="px-8 py-5 font-black">
                                                    <div className="flex flex-col">
                                                        <span className="text-emerald-600">
                                                            {log.checkIn?.includes('T') 
                                                                ? new Date(log.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                                                : log.checkIn}
                                                        </span>
                                                        <span className="text-red-600 text-[10px]">
                                                            {log.checkOut 
                                                                ? (log.checkOut.includes('T')
                                                                    ? new Date(log.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                                                    : log.checkOut)
                                                                : '--:--'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-600">
                                                            {log.duration_minutes ? `${Math.floor(log.duration_minutes / 60)}j ${log.duration_minutes % 60}m` : '-'}
                                                        </span>
                                                        {log.overtime_minutes ? (
                                                            <span className="text-[10px] font-black text-blue-500">+{log.overtime_minutes}m Lembur</span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ring-1 ${isOffDayWork ? 'bg-orange-50 text-orange-600 ring-orange-100' :
                                                            log.status === 'Late' ? 'bg-yellow-50 text-yellow-600 ring-yellow-100' :
                                                                'bg-emerald-50 text-emerald-600 ring-emerald-100'
                                                            }`}>
                                                            {isOffDayWork ? 'Lembur' : (log.status === 'Late' ? 'Terlambat' : 'Hadir')}
                                                        </span>
                                                        {log.late_minutes ? (
                                                            <span className="text-[9px] font-bold text-rose-500">-{log.late_minutes}m</span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                {isAtleastAdmin && (
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setEditingLog(log)} className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors">
                                                                <Search className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDeleteLog(log)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
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
                            {employees.map(emp => (
                                <button
                                    key={emp.id}
                                    onClick={() => handleManualAttendance(emp)}
                                    className="w-full flex items-center justify-between p-5 rounded-3xl border border-gray-100 hover:bg-gray-50 hover:border-primary/20 transition-all group"
                                >
                                    <div className="text-left">
                                        <div className="font-black text-gray-800 group-hover:text-primary transition-colors">{emp.name}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{emp.position}</div>
                                    </div>
                                    <Plus className="w-5 h-5 text-gray-300 group-hover:text-primary" />
                                </button>
                            ))}
                        </div>
                        <div className="p-8 border-t border-gray-50 bg-gray-50/10 flex gap-3">
                            <Button variant="outline" className="flex-1 h-14 rounded-2xl" onClick={() => setIsManualModalOpen(false)}>Batal</Button>
                        </div>
                    </div>
                </div>
            )}

            {isAddHistoryModalOpen && (
                <AttendanceFormModal 
                    employees={employees}
                    onClose={() => setIsAddHistoryModalOpen(false)}
                    onSubmit={async (data) => {
                        if (onLogAttendance) await onLogAttendance({ ...data, isNew: true }, 'create');
                        setIsAddHistoryModalOpen(false);
                    }}
                />
            )}

            {editingLog && (
                <AttendanceFormModal 
                    employees={employees}
                    initialData={editingLog}
                    onClose={() => setEditingLog(null)}
                    onSubmit={async (data) => {
                        if (onLogAttendance) await onLogAttendance({ ...data, id: editingLog.id, isNew: false }, 'update');
                        setEditingLog(null);
                    }}
                />
            )}
        </div>
    );
}

function AttendanceFormModal({ employees, initialData, onClose, onSubmit }: { employees: Employee[], initialData?: AttendanceLog, onClose: () => void, onSubmit: (data: any) => Promise<void> }) {
    const [employeeName, setEmployeeName] = useState(initialData?.employeeName || '');
    const [date, setDate] = useState(initialData?.date || (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })());
    const [checkIn, setCheckIn] = useState(initialData?.checkIn || '08:00');
    const [checkOut, setCheckOut] = useState(initialData?.checkOut || '');
    const [status, setStatus] = useState(initialData?.status || 'Present');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeName) return toast.error('Pilih Karyawan');
        setIsSubmitting(true);
        try {
            await onSubmit({ employeeName, date, checkIn, checkOut, status });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                <form onSubmit={handleSubmit}>
                    <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="text-xl font-black text-gray-800">{initialData ? 'Ubah Riwayat' : 'Tambah Riwayat'}</h3>
                            <p className="text-xs text-gray-500 font-medium tracking-tight">Data kehadiran karyawan manual.</p>
                        </div>
                        <button type="button" onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
                    </div>
                    <div className="p-8 space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Karyawan</label>
                            <select 
                                value={employeeName} 
                                onChange={(e) => setEmployeeName(e.target.value)} 
                                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 font-bold text-gray-700"
                                disabled={!!initialData}
                            >
                                <option value="">Pilih Karyawan...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.name}>{emp.name} ({emp.position})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Tanggal</label>
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 font-bold text-gray-700" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Status</label>
                                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 font-bold text-gray-700">
                                    <option value="Present">Hadir</option>
                                    <option value="Late">Terlambat</option>
                                    <option value="Off Day Work">Lembur (Off Day)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Jam Masuk</label>
                                <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 font-bold text-gray-700" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Jam Pulang</label>
                                <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 font-bold text-gray-700" />
                            </div>
                        </div>
                    </div>
                    <div className="p-8 border-t border-gray-50 bg-gray-50/10 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-16 rounded-[24px] font-bold" onClick={onClose} disabled={isSubmitting}>Batal</Button>
                        <Button type="submit" className="flex-1 h-16 rounded-[24px] font-bold shadow-xl shadow-primary/20" disabled={isSubmitting}>
                            {isSubmitting ? 'Menyimpan...' : (initialData ? 'Simpan Perubahan' : 'Tambah Ke Riwayat')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
