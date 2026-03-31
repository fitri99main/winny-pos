import { useState } from 'react';
import { Shield, X, ChevronRight, Calculator } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface ManagerAuthModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (manager: any) => void;
    employees: any[];
    title?: string;
    description?: string;
}

export function ManagerAuthModal({
    open,
    onClose,
    onSuccess,
    employees,
    title = "Otorisasi Manager Dibutuhkan",
    description = "Masukkan 6-digit PIN Manager atau Admin untuk melanjutkan."
}: ManagerAuthModalProps) {
    const [pin, setPin] = useState('');

    const handlePinPress = (num: string) => {
        if (num === 'C') setPin('');
        else if (num === 'BS') setPin(prev => prev.slice(0, -1));
        else if (pin.length < 6) setPin(prev => prev + num);
    };

    const handleSubmit = () => {
        if (pin.length < 1) return;

        // Filter for managers and admins
        const managers = employees.filter(e => 
            e.system_role === 'Administrator' || 
            (e.position && e.position.toLowerCase().includes('manager'))
        );

        // Find match by PIN
        const matchedManager = managers.find(m => (m.pin || String(m.id)) === pin);

        if (matchedManager) {
            toast.success(`Otorisasi berhasil oleh ${matchedManager.name}`);
            onSuccess(matchedManager);
            setPin('');
            onClose();
        } else {
            toast.error('PIN tidak valid atau tidak memiliki akses Manager.');
            setPin('');
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
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

                    {/* PIN Display */}
                    <div className="w-full bg-gray-50 rounded-2xl h-16 flex items-center justify-center border border-gray-100 shadow-inner px-4">
                        <div className="flex gap-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${i < pin.length
                                        ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] scale-110'
                                        : 'bg-gray-200'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handlePinPress(String(num))}
                                className="aspect-square rounded-2xl bg-white hover:bg-gray-50 border border-gray-100 text-2xl font-bold transition-all active:scale-90 flex items-center justify-center shadow-sm group text-gray-700"
                            >
                                <span className="group-hover:scale-110 transition-transform">{num}</span>
                            </button>
                        ))}
                        <button 
                            onClick={() => handlePinPress('C')} 
                            className="aspect-square rounded-2xl bg-red-50 text-red-500 font-bold hover:bg-red-100 flex items-center justify-center transition-all active:scale-90 border border-red-100 text-lg"
                        >
                            C
                        </button>
                        <button 
                            onClick={() => handlePinPress('0')} 
                            className="aspect-square rounded-2xl bg-white hover:bg-gray-50 border border-gray-100 text-2xl font-bold flex items-center justify-center transition-all active:scale-90 text-gray-700"
                        >
                            0
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={pin.length === 0}
                            className={`aspect-square rounded-2xl shadow-lg flex items-center justify-center transition-all active:scale-90 ${
                                pin.length > 0 ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            <ChevronRight className="w-8 h-8" />
                        </button>
                    </div>
                </div>

                <div className="p-8 pt-0">
                    <Button variant="ghost" className="w-full h-12 rounded-2xl font-bold text-gray-400 hover:text-gray-600" onClick={onClose}>
                        Batal
                    </Button>
                </div>
            </div>
        </div>
    );
}
