import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Banknote, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface CashierSessionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'open' | 'close';
    session?: any;
    onSessionComplete: (session: any) => void;
    settings?: any;
}

export function CashierSessionModal({
    open,
    onOpenChange,
    mode,
    session,
    onSessionComplete,
    settings
}: CashierSessionModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // Open Session State
    const [startingCash, setStartingCash] = useState('');
    const [notes, setNotes] = useState('');

    // Close Session State
    const [actualCash, setActualCash] = useState('');
    const [closingData, setClosingData] = useState<any>(null);

    // Reset form when opening
    useEffect(() => {
        if (open) {
            if (mode === 'open') {
                setStartingCash('');
                setNotes('');
            } else if (mode === 'close' && session) {
                calculateClosingData();
            }
        }
    }, [open, mode, session]);

    const calculateClosingData = async () => {
        if (!session) return;
        setLoading(true);
        try {
            // Fetch sales for this session
            // Assuming we track sales with session_id or just by time range since opened_at
            // Since we don't have session_id in sales yet, we'll use time range for now
            // But ideally we should link them. For now, use time > opened_at.

            const { data: sales, error } = await supabase
                .from('sales')
                .select('*')
                .gte('created_at', session.opened_at)
                .is('deleted_at', null); // Exclude deleted

            if (error) throw error;

            let cash = 0;
            let card = 0;
            let qris = 0;
            let total = 0;

            sales?.forEach(sale => {
                const amount = sale.paid_amount || sale.total_amount; // Use paid amount
                total += amount;
                if (sale.payment_method === 'Cash' || sale.payment_method === 'Tunai') cash += amount;
                else if (sale.payment_method === 'Card' || sale.payment_method === 'Kartu') card += amount;
                else qris += amount; // Assume others are QRIS/E-wallet
            });

            const startCash = parseFloat(session.starting_cash) || 0;

            setClosingData({
                cash_sales: cash,
                card_sales: card,
                qris_sales: qris,
                total_sales: total,
                expected_cash: startCash + cash
            });
            setActualCash('');

        } catch (err: any) {
            console.error('Error calculating closing:', err);
            toast.error('Gagal menghitung ringkasan shift');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSession = async () => {
        if (!startingCash && settings?.require_starting_cash) {
            toast.error('Masukkan modal awal');
            return;
        }

        setLoading(true);
        try {
            const newSession = {
                user_id: user?.id,
                branch_id: user?.user_metadata?.branch_id || 'default',
                employee_name: user?.user_metadata?.name || user?.email,
                opened_at: new Date().toISOString(),
                starting_cash: parseFloat(startingCash) || 0,
                status: 'Open',
                notes: notes
            };

            const { data, error } = await supabase
                .from('cashier_sessions')
                .insert(newSession)
                .select()
                .single();

            if (error) throw error;

            toast.success('Shift Dimulai', { description: 'Selamat bekerja!' });
            onSessionComplete(data);
            onOpenChange(false);

        } catch (err: any) {
            toast.error('Gagal membuka shift: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSession = async () => {
        if (!actualCash && settings?.require_blind_close) {
            toast.error('Masukkan jumlah uang tunai di laci');
            return;
        }

        setLoading(true);
        try {
            const actual = parseFloat(actualCash) || 0;
            const expected = closingData?.expected_cash || 0;
            const difference = actual - expected;

            const updateData = {
                closed_at: new Date().toISOString(),
                status: 'Closed',
                cash_sales: closingData?.cash_sales || 0,
                card_sales: closingData?.card_sales || 0,
                qris_sales: closingData?.qris_sales || 0,
                total_sales: closingData?.total_sales || 0,
                expected_cash: expected,
                actual_cash: actual,
                difference: difference,
                notes: notes
            };

            const { data, error } = await supabase
                .from('cashier_sessions')
                .update(updateData)
                .eq('id', session.id)
                .select()
                .single();

            if (error) throw error;

            toast.success('Shift Ditutup', {
                description: `Selisih: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(difference)}`
            });
            onSessionComplete(null); // Clear session
            onOpenChange(false);

        } catch (err: any) {
            toast.error('Gagal menutup shift: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

    return (
        <Dialog open={open} onOpenChange={(v) => {
            // Prevent closing if modal is required for open shift
            if (!v && mode === 'open' && settings?.require_starting_cash && !session) {
                // Determine if we can close? Maybe if user cancels, they can't use POS.
                // For now allow close but they will be prompted again or blocked actions?
                // Better to allow close so they can go back.
            }
            onOpenChange(v);
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{mode === 'open' ? 'Buka Shift Kasir' : 'Tutup Shift'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'open'
                            ? 'Masukkan modal awal untuk memulai sesi kasir.'
                            : 'Rekonsiliasi uang tunai dan tutup sesi.'}
                    </DialogDescription>
                </DialogHeader>

                {mode === 'open' && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Modal Awal (Cash)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                                <Input
                                    type="number"
                                    className="pl-10 text-lg font-bold"
                                    placeholder="0"
                                    value={startingCash}
                                    onChange={e => setStartingCash(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Catatan (Opsional)</Label>
                            <Input
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Cth: Shift Pagi"
                            />
                        </div>
                    </div>
                )}

                {mode === 'close' && (
                    <div className="space-y-4 py-4">
                        {loading && !closingData ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                {/* Summary - Hide if Blind Close is strictly enforced and not yet entered? 
                                    User requirement: "Blind Close: Kasir harus menghitung uang fisik sebelum melihat total sistem API".
                                    So if require_blind_close is true, we should HIDE the expected cash until they input actual cash? 
                                    Or simpler: Input actual cash first, then show comparison.
                                */}

                                {!settings?.require_blind_close && (
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                                        <div>
                                            <span className="text-gray-500 block">Penjualan Tunai</span>
                                            <span className="font-bold">{formatPrice(closingData?.cash_sales)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block">Modal Awal</span>
                                            <span className="font-bold">{formatPrice(session?.starting_cash)}</span>
                                        </div>
                                        <div className="col-span-2 pt-2 border-t border-gray-200">
                                            <span className="text-gray-500 block">Total Uang Fisik Di Sistem</span>
                                            <span className="font-bold text-lg text-primary">{formatPrice(closingData?.expected_cash)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Total Uang Tunai Aktual (Hitung Laci)</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                                        <Input
                                            type="number"
                                            className="pl-10 text-lg font-bold"
                                            placeholder="0"
                                            value={actualCash}
                                            onChange={e => setActualCash(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    {settings?.require_blind_close && (
                                        <p className="text-xs text-orange-500 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Blind Close Aktif: Masukkan total hitungan manual.
                                        </p>
                                    )}
                                </div>

                                {/* Show difference live if NOT blind close, or maybe only after submit? 
                                    Usually blind close means you submit, THEN you see the result.
                                */}
                                {!settings?.require_blind_close && actualCash && (
                                    <div className={`p-3 rounded-lg text-sm font-bold flex justify-between ${(parseFloat(actualCash) - (closingData?.expected_cash || 0)) === 0
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-red-50 text-red-700'
                                        }`}>
                                        <span>Selisih:</span>
                                        <span>{formatPrice(parseFloat(actualCash) - (closingData?.expected_cash || 0))}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button
                        onClick={mode === 'open' ? handleOpenSession : handleCloseSession}
                        disabled={loading}
                        className="bg-primary text-white"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'open' ? 'Buka Shift' : 'Tutup Shift & Laporan')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
