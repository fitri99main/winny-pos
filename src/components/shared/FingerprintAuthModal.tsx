import { useState, useEffect, useRef } from 'react';
import { Shield, Zap, X, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

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
    const [inputBuffer, setInputBuffer] = useState('');
    const lastInputTime = useRef<number>(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setInputBuffer('');
            setError(null);
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            if (now - lastInputTime.current > 100) {
                setInputBuffer('');
            }
            lastInputTime.current = now;

            if (e.key === 'Enter') {
                if (inputBuffer.length >= 3) {
                    validateAuth(inputBuffer);
                    setInputBuffer('');
                }
            } else if (e.key.length === 1) {
                setInputBuffer(prev => prev + e.key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, inputBuffer, employees]);

    const validateAuth = (id: string) => {
        const manager = employees.find(e =>
            (e.barcode === id || `EMP-${e.id}` === id || e.id.toString() === id) &&
            (e.system_role === 'Administrator' || e.position?.toLowerCase().includes('manager'))
        );

        if (manager) {
            onSuccess(manager);
            onClose();
        } else {
            setError("Otorisasi Gagal: Fingerprint tidak dikenali sebagai Manager/Admin.");
            setTimeout(() => setError(null), 3000);
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
                        <div className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-700 rounded-2xl border border-red-100 animate-in shake duration-300">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">{error}</span>
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
