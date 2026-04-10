import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Banknote, AlertTriangle, CheckCircle2, LogIn, LogOut, CheckCircle, AlertCircle, ShoppingCart, CreditCard, Wallet, History, Printer, Eye, X, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { printerService } from '@/lib/PrinterService';
import { PettyCashService } from '@/lib/PettyCashService';

interface CashierSessionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'open' | 'close' | 'force_close';
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
    const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);

    // Form State
    const [startingCash, setStartingCash] = useState('');
    const [notes, setNotes] = useState('');
    const [actualCash, setActualCash] = useState('');
    const [closingData, setClosingData] = useState<any>(null);

    // Reset form when opening
    useEffect(() => {
        if (open) {
            if (mode === 'open') {
                setStartingCash('');
                setNotes('');
            } else if ((mode === 'close' || mode === 'force_close') && session) {
                calculateClosingData();
            }
        }
    }, [open, mode, session]);

    const calculateClosingData = async () => {
        if (!session) return;
        setLoading(true);
        try {
            // [MODIFIED] Use ISO string for robust date comparison across timezones
            const openedAt = new Date(session.opened_at).toISOString();
            
            const { data: sales, error } = await supabase
                .from('sales')
                .select('*')
                .gte('created_at', openedAt);

            if (error) throw error;

            let cash = 0;
            let nonCash = 0;
            let total = 0;
            let discount = 0;
            let tax = 0;
            let completed = 0;
            let pending = 0;
            const paySummary: Record<string, number> = {};

            sales?.forEach(sale => {
                const status = (sale.status || '').toLowerCase();
                // [MODIFIED] Broaden paid status check to catch all successful transactions
                const isPaid = ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture'].includes(status);
                
                if (isPaid) {
                    completed++;
                    const amount = (sale.paid_amount || sale.total_amount || 0);
                    total += amount;
                    discount += (sale.discount || 0);
                    tax += (sale.tax || 0);

                    const rawMethod = sale.payment_method || 'Tunai';
                    const method = rawMethod.trim();
                    paySummary[method] = (paySummary[method] || 0) + amount;

                    const lowerMethod = method.toLowerCase();
                    const isCash = lowerMethod === 'cash' || 
                                  lowerMethod === 'tunai' || 
                                  lowerMethod === 'uang tunai' ||
                                  lowerMethod === 'cash ';

                    if (isCash) {
                        cash += amount;
                    } else {
                        nonCash += amount;
                    }
                } else if (['pending', 'waiting', 'unpaid', 'checkout'].includes(status)) {
                    pending++;
                }
            });

            // Fetch Sale Items for Category & Product Summary
            const saleIds = sales?.map(s => s.id) || [];
            let catSummary: Record<string, number> = {};
            let prodSummary: Record<string, { quantity: number; amount: number; category: string }> = {};

            if (saleIds.length > 0) {
                // [NEW] Robust category lookup maps
                const { data: allProducts } = await supabase.from('products').select('id, name, category');
                const productCatMap: Record<string, string> = {};
                const productIdMap: Record<number, string> = {};
                
                allProducts?.forEach(p => {
                    const cat = (p.category || 'LAINNYA').toUpperCase();
                    if (p.name) productCatMap[p.name] = cat;
                    if (p.id) productIdMap[Number(p.id)] = cat;
                });

                const { data: items, error: itemsError } = await supabase
                    .from('sale_items')
                    .select('product_id, product_name, quantity, price') // Use correct column names
                    .in('sale_id', saleIds);
                
                if (!itemsError && items && items.length > 0) {
                    items.forEach(item => {
                        // [MODIFIED] Multi-layer category lookup
                        const name = item.product_name || 'Produk';
                        const productId = item.product_id ? Number(item.product_id) : null;
                        const cat = (productId ? productIdMap[productId] : null) || productCatMap[name] || 'LAINNYA';
                        
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.price) || 0;
                        const amount = qty * price;

                        if (amount > 0) {
                            catSummary[cat] = (catSummary[cat] || 0) + amount;
                            if (!prodSummary[name]) prodSummary[name] = { quantity: 0, amount: 0, category: cat };
                            prodSummary[name].quantity += qty;
                            prodSummary[name].amount += amount;
                        }
                    });
                }
            }

            setClosingData({
                total_sales: total,
                cash_sales: cash,
                non_cash_sales: nonCash,
                expected_cash: (parseFloat(session.starting_cash) || 0) + cash,
                completed_count: completed,
                pending_count: pending,
                total_discount: discount,
                total_tax: tax,
                payment_summary: Object.entries(paySummary).map(([method, amount]) => ({ method, amount })),
                category_summary: Object.entries(catSummary).map(([category, amount]) => ({ category, amount })),
                product_summary: Object.entries(prodSummary).map(([name, data]) => ({ name, ...data }))
            });
            setActualCash('');

        } catch (err: any) {
            console.error('Error calculating closing:', err);
            toast.error('Gagal menghitung ringkasan shift');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintSalesReport = async () => {
        if (!closingData || !session) return;
        
        try {
            const dateRange = `Shift: ${new Date(session.opened_at).toLocaleString('id-ID')} - Selesai`;
            
            await printerService.printSalesReport({
                title: 'LAPORAN SHIFT KASIR',
                dateRange,
                totalOrders: closingData.completed_count + closingData.pending_count,
                completedCount: closingData.completed_count,
                pendingCount: closingData.pending_count,
                totalSales: closingData.total_sales,
                totalDiscount: closingData.total_discount,
                totalTax: closingData.total_tax,
                openingBalance: parseFloat(session.starting_cash) || 0,
                cashTotal: closingData.cash_sales,
                qrTotal: closingData.non_cash_sales,
                expectedCash: closingData.expected_cash,
                actualCash: parseFloat(actualCash) || 0,
                variance: (parseFloat(actualCash) || 0) - closingData.expected_cash,
                paymentSummary: closingData.payment_summary || [],
                categorySummary: closingData.category_summary || [],
                productSummary: (closingData.product_summary || []).map((p: any) => ({
                    ...p,
                    name: p.category ? `[${p.category}] ${p.name}` : p.name
                }))
            });
            toast.success('Laporan berhasil dicetak');
        } catch (err) {
            console.error('Print error:', err);
            toast.error('Gagal mencetak laporan');
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
                non_cash_sales: closingData?.non_cash_sales || 0,
                total_income: closingData?.total_sales || 0, // Using total_sales as total_income
                total_sales: closingData?.total_sales || 0,
                expected_cash: expected,
                actual_cash: actual,
                difference: difference,
                payment_summary: closingData?.payment_summary || [], // [NEW] Save summary
                category_summary: closingData?.category_summary || [], // [NEW] Save category breakdown
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
                description: `Selisih: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(difference)}`,
                duration: 3000
            });

            // [NEW] Automatic Petty Cash Deposit
            try {
                const branchId = user?.user_metadata?.branch_id || '7';
                const activePcSession = await PettyCashService.getActiveSession(branchId);
                if (activePcSession) {
                    await PettyCashService.addTransaction({
                        session_id: activePcSession.id,
                        type: 'TOPUP',
                        amount: actual,
                        description: `Setoran Kasir: ${user?.user_metadata?.name || user?.email} (Shift #${session.id})`,
                        reference_type: 'cashier_closing',
                        reference_id: String(session.id)
                    });
                    toast.success('Setoran Kasir masuk ke Kas Kecil otomatis');
                }
            } catch (pcErr) {
                console.error('Petty Cash Deposit Error:', pcErr);
                // Silent fail for petty cash - don't block session close
            }

            // Re-fetch session status in Home.tsx via context if needed
            setTimeout(async () => {
                await supabase.auth.signOut();
                onSessionComplete(null);
                onOpenChange(false);
            }, 1500);

        } catch (err: any) {
            toast.error('Gagal menutup shift: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

    return (
        <>
            <Dialog open={open} onOpenChange={(v) => {
                if (!v && mode === 'open' && settings?.require_mandatory_session && !session) {
                    toast.warning('Shift wajib dibuka!', { description: 'Akses dibatasi sebelum shift dibuka.' });
                    return;
                }
                onOpenChange(v);
            }}>
                <DialogContent className="max-w-md p-6 bg-white rounded-3xl shadow-2xl border-none">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-800 tracking-tight">
                            <div className={`p-2 rounded-xl text-white shadow-lg ${mode === 'open' ? 'bg-green-500 shadow-green-100' : 'bg-blue-600 shadow-blue-100'}`}>
                                {mode === 'open' ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
                            </div>
                            {mode === 'open' ? 'Buka Shift Kasir' : (mode === 'force_close' ? 'Tutup Paksa Shift' : 'Tutup Shift Kasir')}
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 mt-1 font-medium">
                            {mode === 'open' 
                                ? 'Silakan masukkan modal awal di laci kasir untuk hari ini.' 
                                : 'Ringkasan keuangan dan rekonsiliasi kas untuk sesi ini.'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {mode === 'open' && (
                        <div className="space-y-6 py-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Jumlah Modal Awal (Cash in Drawer)</Label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                                    <Input
                                        type="number"
                                        className="pl-12 h-14 text-xl font-bold rounded-2xl"
                                        placeholder="0"
                                        value={startingCash}
                                        onChange={e => setStartingCash(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {(mode === 'close' || mode === 'force_close') && (
                        <div className="space-y-6 py-4">
                            {loading && !closingData ? (
                                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : (
                                <>
                                    {!settings?.require_blind_close && (
                                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                                        <div className="flex justify-between items-end border-b border-blue-200/20 pb-3">
                                            <div>
                                                <span className="text-blue-600 font-bold text-[10px] uppercase tracking-widest block">Status</span>
                                                <div className="flex gap-3 text-xs mt-1 font-bold">
                                                    <span className="text-green-700">{closingData?.completed_count || 0} Selesai</span>
                                                    <span className="text-orange-700">{closingData?.pending_count || 0} Menunggu</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-blue-600 font-bold text-[10px] uppercase tracking-widest block">Total Net</span>
                                                <span className="text-blue-900 font-bold text-lg">{formatPrice(closingData?.total_sales)}</span>
                                            </div>
                                        </div>

                                        {/* [NEW] Main Category Breakdown View */}
                                        {(closingData?.category_summary || []).length > 0 && (
                                            <div className="py-2 border-b border-blue-200/20">
                                                <span className="text-blue-500 font-bold text-[9px] uppercase tracking-widest block mb-2">Ringkasan Kategori</span>
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                                    {closingData?.category_summary.map((c: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-[11px]">
                                                            <span className="text-gray-500 font-medium truncate max-w-[100px]">{c.category}</span>
                                                            <span className="text-blue-900 font-bold">{formatPrice(c.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="pt-1">
                                                <span className="text-blue-500/80 block text-[9px] font-bold uppercase">PENERIMAAN TUNAI</span>
                                                <span className="font-bold text-blue-900">{formatPrice(closingData?.cash_sales)}</span>
                                            </div>
                                            <div className="pt-1">
                                                <span className="text-blue-500/80 block text-[9px] font-bold uppercase">PENERIMAAN NON-TUNAI</span>
                                                <span className="font-bold text-blue-900">{formatPrice(closingData?.non_cash_sales)}</span>
                                            </div>
                                            <div className="pt-1 col-span-2">
                                                <span className="text-blue-500/80 block text-[9px] font-bold uppercase tracking-tight">TOTAL SEHARUSNYA</span>
                                                <span className="font-bold text-blue-950 text-base">{formatPrice(closingData?.expected_cash)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    )}

                                    <div className="space-y-3">
                                        <Label className="text-sm font-bold text-gray-700">Total Uang Tunai Aktual (Hitungan Fisik)</Label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                                            <Input
                                                type="number"
                                                className="pl-12 h-14 text-xl font-bold rounded-2xl focus:ring-blue-500"
                                                placeholder="0"
                                                value={actualCash}
                                                onChange={e => setActualCash(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {!settings?.require_blind_close && actualCash && (
                                        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                                            (parseFloat(actualCash) - (closingData?.expected_cash || 0)) === 0
                                                ? 'bg-green-50 border-green-100 text-green-700'
                                                : 'bg-red-50 border-red-100 text-red-700'
                                            }`}>
                                            <span className="text-xs font-bold uppercase tracking-wider">Selisih (Variance)</span>
                                            <span className="text-lg font-bold">{formatPrice(parseFloat(actualCash) - (closingData?.expected_cash || 0))}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-3 pt-6">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-gray-500">Batal</Button>
                        <div className="flex-1 flex gap-2">
                            {(mode === 'close' || mode === 'force_close') && closingData && (
                                <>
                                    <Button variant="outline" onClick={() => setIsReportPreviewOpen(true)} className="flex-1 h-12 rounded-xl border-blue-200 text-blue-700 font-bold">
                                        <Eye className="w-4 h-4 mr-2" /> Pratinjau
                                    </Button>
                                    <Button variant="outline" onClick={handlePrintSalesReport} className="flex-1 h-12 rounded-xl border-gray-200 text-gray-700 font-bold">
                                        <Printer className="w-4 h-4 mr-2" /> Cetak
                                    </Button>
                                </>
                            )}
                            <Button
                                onClick={mode === 'open' ? handleOpenSession : handleCloseSession}
                                disabled={loading || (mode === 'close' && !actualCash)}
                                className={`flex-[1.5] h-12 rounded-xl font-bold text-white ${mode === 'open' ? 'bg-green-600 hover:bg-green-700' : 'bg-primary'}`}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'open' ? 'Buka Shift' : 'Tutup Shift')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print Preview Modal - Separated from main Dialog to avoid nesting issues if possible */}
            <Dialog open={isReportPreviewOpen} onOpenChange={setIsReportPreviewOpen}>
                <DialogContent className="max-w-[400px] p-0 overflow-hidden bg-white border-none shadow-2xl rounded-3xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Pratinjau Struk</DialogTitle>
                        <DialogDescription>Simulasi cetakan laporan shift thermal.</DialogDescription>
                    </DialogHeader>

                    <div className="px-6 py-4 border-b flex justify-between items-center bg-white sticky top-0 z-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Printer className="w-5 h-5 text-blue-600" />
                            <span>Simulasi Struk Thermal</span>
                        </h3>
                        <button onClick={() => setIsReportPreviewOpen(false)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-10 overflow-y-auto max-h-[70vh] flex justify-center bg-gray-100/50">
                        <div className={`bg-white shadow-xl border border-gray-200 p-8 font-mono text-[10px] space-y-1 text-gray-800 ${printerService.getTemplate().paperWidth === '80mm' ? 'w-[320px]' : 'w-[240px]'}`}>
                            {/* Header */}
                            <div className="text-center space-y-1 mb-6">
                                <div className="font-extrabold text-sm uppercase">{printerService.getTemplate().header || 'WINNY PANGERAN NATAKUSUMA'}</div>
                                <div className="whitespace-pre-line text-[9px] opacity-70 italic font-bold">{printerService.getTemplate().address || ''}</div>
                            </div>

                            <div className="text-center font-extrabold text-xs border-y-2 border-double py-2 mb-4 bg-gray-50 uppercase tracking-widest text-[10px]">Laporan Sesi Shift</div>

                            {/* Session Detail */}
                            <div className="space-y-1 mb-4 text-[10px] border-b border-dotted pb-2">
                                <div className="flex justify-between"><span className="opacity-70">Kasir:</span><span className="font-bold">{session?.employee_name || user?.user_metadata?.name || 'Admin'}</span></div>
                                <div className="flex justify-between"><span className="opacity-70">Buka:</span><span>{new Date(session?.opened_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                                <div className="flex justify-between"><span className="opacity-70">Tutup:</span><span>{new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                            </div>

                            <p className="text-center opacity-30">--------------------------------</p>

                            {/* Financials */}
                            <div className="space-y-1 py-2">
                                <div className="flex justify-between font-extrabold"><span>TRANSAKSI SELESAI ({closingData?.completed_count || 0})</span><span>{formatPrice(closingData?.total_sales)}</span></div>
                                <div className="flex justify-between italic"><span>TOTAL DISKON</span><span>-{(closingData?.total_discount || 0).toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between italic"><span>TOTAL PAJAK</span><span>{(closingData?.total_tax || 0).toLocaleString('id-ID')}</span></div>
                            </div>

                            <p className="text-center opacity-30">--------------------------------</p>

                            {/* Category Summary */}
                            <div className="space-y-1 py-2">
                                <div className="font-extrabold text-center uppercase text-[9px] border-b pb-1 mb-2">Ringkasan Kategori</div>
                                {(closingData?.category_summary || []).length > 0 ? (
                                    closingData.category_summary.map((c: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center py-0.5">
                                            <span className="uppercase tracking-tighter opacity-70 font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">{c.category}</span>
                                            <span className="font-bold">{c.amount.toLocaleString('id-ID')}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center italic opacity-50 py-1">Tidak ada data kategori</div>
                                )}
                            </div>

                            <p className="text-center opacity-30">--------------------------------</p>

                            {/* Reconciliation */}
                            <div className="space-y-1 py-3 px-2 bg-gray-50/50 rounded">
                                <div className="flex justify-between opacity-70"><span>MODAL AWAL</span><span>{(parseFloat(session?.starting_cash) || 0).toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between opacity-70"><span>PENERIMAAN TUNAI</span><span>{(closingData?.cash_sales || 0).toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between font-extrabold border-t border-dotted mt-2 text-xs"><span>SELISIH KAS</span><span className="text-blue-800">{( (Number(actualCash) || 0) - (closingData?.expected_cash || 0) ).toLocaleString('id-ID')}</span></div>
                            </div>

                            <p className="text-center mt-6 opacity-30">--------------------------------</p>
                            <div className="text-center opacity-40 text-[7px] font-bold">DIGENERASI PADA {new Date().toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="p-6 bg-white border-t flex gap-4">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold text-gray-500" onClick={() => setIsReportPreviewOpen(false)}>Tutup</Button>
                        <Button className="flex-[2] h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold gap-3 text-lg" onClick={() => {
                            handlePrintSalesReport();
                            setIsReportPreviewOpen(false);
                        }}>
                            <Printer className="w-6 h-6" /> Cetak Sekarang
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
