import { useState, useEffect, useRef } from 'react';
import { Shield, Zap, X, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { fingerprint, FingerprintResult } from '../../lib/fingerprint';

interface FingerprintAuthModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (manager: any) => void;
    employees: any[];
    title?: string;
    description?: string;
}

export function FingerprintAuthModal({
    open,
    onClose,
    onSuccess,
    employees,
    title = "Otorisasi Manager Dibutuhkan",
    description = "Silakan tempelkan jari Manager atau Administrator pada scanner untuk melanjutkan."
}: FingerprintAuthModalProps) {
    const [error, setError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [fpStatus, setFpStatus] = useState<string>('');

    useEffect(() => {
        if (open) {
            handleStartScanning();
        } else {
            handleStopScanning();
        }
    }, [open]);

    const handleStopScanning = async () => {
        await fingerprint.stopCapture();
        setIsScanning(false);
        setFpStatus('');
    };

    const handleStartScanning = async (useMock: boolean = false) => {
        setIsScanning(true);
        setFpStatus(useMock ? 'Simulasi: Memindai Jari...' : 'Menghubungkan ke Pemindai...');
        setError(null);

        const callback = (status: string, result?: FingerprintResult) => {
            console.log('Fingerprint Auth Status:', status, result);

            if (status === 'SUCCESS' && result?.success && result.template) {
                setFpStatus('Mencocokkan Sidik Jari...');

                // Validate against Manager/Admin templates
                const matches = employees
                    .filter(e => e.fingerprint_template &&
                        (e.system_role === 'Administrator' || e.position?.toLowerCase().includes('manager')))
                    .map(e => ({
                        emp: e,
                        score: fingerprint.calculateSimilarity(e.fingerprint_template!, result.template!)
                    }))
                    .sort((a, b) => b.score - a.score);

                const bestMatch = matches[0];

                if (bestMatch && bestMatch.score >= 10) {
                    const manager = bestMatch.emp;
                    setFpStatus('Otorisasi Berhasil!');
                    setTimeout(() => {
                        onSuccess(manager);
                        onClose();
                        setIsScanning(false);
                    }, 1000);
                } else {
                    setError("Otorisasi Gagal: Sidik jari tidak dikenali sebagai Manager/Admin.");
                    setFpStatus('');
                    handleStartScanning(useMock); // Restart scanning
                }
            } else if (status === 'ERROR') {
                if (!useMock && result?.errorType === 'SERVICE_NOT_RUNNING') {
                    if (confirm('Layanan DigitalPersona tidak terdeteksi. Gunakan SIMULASI untuk tes?')) {
                        handleStartScanning(true);
                        return;
                    }
                }
                setError(result?.message || 'Gagal membaca sidik jari');
                setIsScanning(false);
            } else {
                setFpStatus(status === 'WAITING_FOR_FINGER' ? 'Silakan Tempel Jari Anda' : status);
            }
        };

        if (useMock) {
            // Pick a manager template from the list for simulation if available
            const managerTemplate = employees.find(e =>
                e.fingerprint_template &&
                (e.system_role === 'Administrator' || e.position?.toLowerCase().includes('manager'))
            )?.fingerprint_template;

            fingerprint.mockCapture((status, result) => {
                if (status === 'SUCCESS' && result && managerTemplate) {
                    result.template = managerTemplate;
                }
                callback(status, result);
            });
        } else {
            await fingerprint.startCapture(callback, 'CAPTURE');
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 pb-4 flex justify-between items-center text-gray-800">
                    <Shield className="w-8 h-8 text-blue-600" />
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-8 pt-2 flex flex-col items-center text-center gap-6">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight">{title}</h3>
                        <p className="text-sm text-gray-500 font-medium px-4">{description}</p>
                    </div>

                    <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-20"></div>
                        <Zap className="w-14 h-14 text-blue-600 animate-pulse" />
                    </div>

                    {error ? (
                        <div className="space-y-4 w-full">
                            <div className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-700 rounded-2xl border border-red-100 animate-in shake duration-300">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wide">{error}</span>
                            </div>

                            {window.location.protocol === 'https:' && (
                                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left space-y-3">
                                    <div className="flex items-center gap-2 text-blue-800 font-bold">
                                        <Shield className="w-4 h-4" />
                                        <span className="text-xs uppercase tracking-tight">Koneksi HTTPS Terdeteksi</span>
                                    </div>
                                    <p className="text-[10px] text-blue-600 leading-relaxed">
                                        Browser memblokir koneksi ke scanner lokal karena alasan keamanan. 
                                        Silakan klik tombol di bawah untuk mengizinkan instruksi SSL:
                                    </p>
                                    <Button 
                                        variant="default" 
                                        size="sm"
                                        className="w-full bg-blue-600 hover:bg-blue-700 h-10 rounded-xl text-[10px] font-bold"
                                        onClick={() => window.open('https://127.0.0.1:52182', '_blank')}
                                    >
                                        Klik & Pilih "Lanjutkan/Proceed"
                                    </Button>
                                    <p className="text-[9px] text-gray-400 italic">
                                        Setelah halaman baru terbuka, pilih "Advanced" lalu "Proceed to 127.0.0.1". Kemudian tutup tab tersebut dan coba lagi di sini.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 text-gray-500 rounded-full border border-gray-100">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-blink"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest font-mono">Standby for Fingerprint...</span>
                        </div>
                    )}
                </div>

                <div className="p-8 pt-0 flex gap-3">
                    <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold" onClick={onClose}>
                        Batal
                    </Button>
                </div>
            </div>
        </div>
    );
}
