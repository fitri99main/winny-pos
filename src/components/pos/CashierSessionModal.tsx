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
            
            // 1. Fetch Sales with Pagination
            let allSales: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: pageData, error: salesError } = await supabase
                    .from('sales')
                    .select('*, items:sale_items(*)')
                    .eq('branch_id', session.branch_id)
                    .gte('date', openedAt)
                    .range(from, from + pageSize - 1);

                if (salesError) throw salesError;
                if (pageData && pageData.length > 0) {
                    allSales = [...allSales, ...pageData];
                    if (pageData.length < pageSize) hasMore = false;
                    else from += pageSize;
                } else {
                    hasMore = false;
                }
            }

            let cash = 0;
            let nonCash = 0;
            let total = 0;
            let discount = 0;
            let tax = 0;
            let completed = 0;
            let pending = 0;
            const paySummary: Record<string, number> = {};

            allSales.forEach(sale => {
                const status = (sale.status || '').toLowerCase();
                // [MODIFIED] Broaden paid status check to catch all successful transactions
                const isPaid = ['completed', 'selesai', 'paid', 'success', 'settlement', 'capture'].includes(status);
                
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

            // [NEW] Fetch Returns during the shift (Subtract from Expected Cash)
            let cashRefunds = 0;
            try {
                const { data: returnData } = await supabase
                    .from('sales_returns')
                    .select('refund_amount, payment_method')
                    .eq('branch_id', session.branch_id)
                    .gte('created_at', openedAt);
                
                (returnData || []).forEach(ret => {
                    if (['tunai', 'cash', 'uang tunai'].includes((ret.payment_method || '').toLowerCase().trim())) {
                        cashRefunds += (Number(ret.refund_amount) || 0);
                    }
                });
            } catch (err) {
                console.error('Error fetching refunds:', err);
            }

            // [NEW] Fetch Petty Cash Expenses during the shift (Subtract from Expected Cash)
            let cashExpenses = 0;
            let cashTopups = 0;
            try {
                const { data: expenseData } = await supabase
                    .from('petty_cash_transactions')
                    .select('amount, type, description')
                    .gte('created_at', openedAt);
                
                (expenseData || []).forEach(exp => {
                    if (exp.type === 'SPEND') {
                        cashExpenses += (Number(exp.amount) || 0);
                    } else if (exp.type === 'TOPUP' && exp.description !== 'Saldo Awal') {
                        cashTopups += (Number(exp.amount) || 0);
                    }
                });
            } catch (err) {
                console.error('Error fetching expenses:', err);
            }

            // Fetch Sale Items for Category & Product Summary
            const saleIds = allSales.map(s => s.id);
            let catSummary: Record<string, number> = {};
            let prodSummary: Record<string, { quantity: number; amount: number; category: string }> = {};

            if (saleIds.length > 0) {
                let allItems: any[] = [];
                let itemFrom = 0;
                let itemHasMore = true;

                while (itemHasMore) {
                    const { data: itemPage, error: itemsError } = await supabase
                        .from('sale_items')
                        .select('product_id, product_name, quantity, price')
                        .in('sale_id', saleIds)
                        .range(itemFrom, itemFrom + pageSize - 1);
                    
                    if (itemsError) throw itemsError;
                    if (itemPage && itemPage.length > 0) {
                        allItems = [...allItems, ...itemPage];
                        if (itemPage.length < pageSize) itemHasMore = false;
                        else itemFrom += pageSize;
                    } else {
                        itemHasMore = false;
                    }
                }
                
                if (allItems.length > 0) {
                    const items = allItems;
                    // 2. Identify unique products that were actually sold
                    const soldProductNameList = Array.from(new Set(items.map(i => i.product_name).filter(Boolean)));
                    const soldProductIdList = Array.from(new Set(items.map(i => i.product_id).filter(id => id !== null && id !== undefined)));

                    // 3. Only fetch categories for these specific products (HEAVILY OPTIMIZED)
                    const orConditions = [];
                    if (soldProductNameList.length > 0) {
                        orConditions.push(`name.in.(${soldProductNameList.map(n => `"${n}"`).join(',')})`);
                    }
                    if (soldProductIdList.length > 0) {
                        orConditions.push(`id.in.(${soldProductIdList.join(',')})`);
                    }

                    const { data: specificProducts } = orConditions.length > 0 
                        ? await supabase
                            .from('products')
                            .select('id, name, category')
                            .or(orConditions.join(','))
                        : { data: [] };

                    const productCatMap: Record<string, string> = {};
                    const productIdMap: Record<number, string> = {};
                    
                    specificProducts?.forEach(p => {
                        const cat = (p.category || 'LAINNYA').toUpperCase();
                        if (p.name) productCatMap[p.name] = cat;
                        if (p.id) productIdMap[Number(p.id)] = cat;
                    });

                    // 4. Summarize based on the optimized results
                    items.forEach(item => {
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
                cash_refunds: cashRefunds,
                cash_expenses: cashExpenses,
                cash_topups: cashTopups,
                expected_cash: (parseFloat(session.starting_cash) || 0) + cash + cashTopups - cashRefunds - cashExpenses,
                completed_count: completed,
                pending_count: pending,
                total_discount: discount,
                total_tax: tax,
                payment_summary: Object.entries(paySummary).map(([method, amount]) => ({ method, amount })),
                category_summary: Object.entries(catSummary).map(([category, amount]) => ({ category, amount })),
                product_summary: Object.entries(prodSummary).map(([name, data]) => ({ name, ...data })),
                sales_list: allSales.filter(s => ['completed', 'selesai', 'paid', 'served', 'success', 'settlement', 'capture', 'ready'].includes((s.status || '').toLowerCase()))
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
                cashRefunds: closingData.cash_refunds,
                cashExpenses: closingData.cash_expenses,
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
                qris_sales: closingData?.non_cash_sales || 0,
                total_income: closingData?.total_sales || 0,
                total_sales: closingData?.total_sales || 0,
                expected_cash: expected,
                actual_cash: actual,
                difference: difference,
                payment_summary: closingData?.payment_summary || [],
                category_summary: closingData?.category_summary || [],
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
            // [MODIFIED] Non-blocking Petty Cash Deposit
            const branchId = user?.user_metadata?.branch_id || '7';
            PettyCashService.getActiveSession(branchId).then(async (activePcSession) => {
                if (activePcSession) {
                    await PettyCashService.addTransaction({
                        session_id: activePcSession.id,
                        type: 'TOPUP',
                        amount: actual,
                        description: `Setoran Kasir: ${user?.user_metadata?.name || user?.email} (Shift #${session.id})`,
                        reference_type: 'cashier_closing',
                        reference_id: String(session.id)
                    });
                    console.log('[Shift] Petty cash deposit success');
                }
            }).catch(pcErr => {
                console.error('[Shift] Petty Cash Deposit Error:', pcErr);
            });

            // Re-fetch session status in Home.tsx via context if needed
            setTimeout(async () => {
                try {
                    await Promise.race([
                        supabase.auth.signOut(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                    ]).catch(err => console.warn('[Shift] Sign out timeout or error:', err));
                } catch (e) {
                    console.error('[Shift] Sign out error:', e);
                }
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
    const cashDifference = (Number(actualCash) || 0) - (closingData?.expected_cash || 0);
    const hasActualCash = actualCash.trim().length > 0;

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
                                : 'Cek total kas lalu masukkan hitungan fisik kasir.'
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
                                    <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-blue-600 font-bold text-[10px] uppercase tracking-widest block">Ringkas</span>
                                                <span className="text-xs text-blue-900 font-semibold">
                                                    {closingData?.completed_count || 0} selesai • {closingData?.pending_count || 0} pending
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-blue-600 font-bold text-[10px] uppercase tracking-widest block">Penjualan</span>
                                                <span className="text-blue-900 font-bold text-lg">{formatPrice(closingData?.total_sales)}</span>
                                            </div>
                                        </div>

                                        {/* Detailed Breakdown Section */}
                        {closingData && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-gray-800">Detail Transaksi</h3>
                                    <div className="text-xs text-gray-500">
                                        Total {closingData.sales_list?.length || 0} transaksi
                                    </div>
                                </div>
                                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Invoice</th>
                                                <th className="px-3 py-2 text-left">Waktu</th>
                                                <th className="px-3 py-2 text-left">Metode</th>
                                                <th className="px-3 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {closingData.sales_list?.slice(0, 50).map((s: any) => (
                                                <tr key={s.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 font-mono text-blue-600">{s.order_no}</td>
                                                    <td className="px-3 py-2 text-gray-500">
                                                        {new Date(s.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-3 py-2">{s.payment_method}</td>
                                                    <td className="px-3 py-2 text-right font-medium">
                                                        Rp {(s.paid_amount || s.total_amount || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                            {closingData.sales_list?.length > 50 && (
                                                <tr>
                                                    <td colSpan={4} className="px-3 py-2 text-center text-gray-400 italic">
                                                        ...dan {closingData.sales_list.length - 50} transaksi lainnya (Cetak laporan untuk detail lengkap)
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                            <div className="rounded-xl bg-white/80 border border-blue-100 px-3 py-2">
                                                <span className="text-blue-500/90 block font-bold uppercase tracking-wide">Penjualan Tunai</span>
                                                <span className="font-bold text-blue-950">{formatPrice(closingData?.cash_sales)}</span>
                                            </div>
                                            <div className="rounded-xl bg-white/80 border border-blue-100 px-3 py-2">
                                                <span className="text-blue-500/90 block font-bold uppercase tracking-wide">Penjualan Non-Tunai</span>
                                                <span className="font-bold text-blue-950">{formatPrice(closingData?.non_cash_sales)}</span>
                                            </div>
                                            <div className="rounded-xl bg-white/80 border border-red-100 px-3 py-2">
                                                <span className="text-red-500/90 block font-bold uppercase tracking-wide">Retur & Pengeluaran</span>
                                                <span className="font-bold text-red-950">{formatPrice((closingData?.cash_refunds || 0) + (closingData?.cash_expenses || 0))}</span>
                                            </div>
                                            <div className="rounded-xl bg-white/80 border border-green-100 px-3 py-2">
                                                <span className="text-green-500/90 block font-bold uppercase tracking-wide">Uang Tunai Seharusnya</span>
                                                <span className="font-bold text-green-950">{formatPrice(closingData?.expected_cash)}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-[11px] mt-2">
                                            <div className="rounded-xl bg-white/80 border border-gray-100 px-3 py-2">
                                                <span className="text-gray-500 block font-bold uppercase tracking-wide">Modal</span>
                                                <span className="font-bold text-gray-800">{formatPrice(parseFloat(session?.starting_cash) || 0)}</span>
                                            </div>
                                            <div className="rounded-xl bg-white/80 border border-gray-100 px-3 py-2">
                                                <span className="text-gray-500 block font-bold uppercase tracking-wide">Top Up Kas</span>
                                                <span className="font-bold text-gray-800">{formatPrice(closingData?.cash_topups || 0)}</span>
                                            </div>
                                        </div>
                                            <div className="rounded-xl bg-blue-600 text-white px-3 py-2">
                                                <span className="block font-bold uppercase tracking-wide text-[10px] text-blue-100">Total Seharusnya (Tunai+Modal)</span>
                                                <span className="font-bold text-base">{formatPrice(closingData?.expected_cash)}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <Label className="text-sm font-bold text-gray-700">Kas Fisik di Laci</Label>
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

                                    {!settings?.require_blind_close && hasActualCash && (
                                        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                                            cashDifference === 0
                                                ? 'bg-green-50 border-green-100 text-green-700'
                                                : 'bg-red-50 border-red-100 text-red-700'
                                            }`}>
                                            <span className="text-xs font-bold uppercase tracking-wider">Selisih Kas</span>
                                            <span className="text-lg font-bold">{formatPrice(cashDifference)}</span>
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
