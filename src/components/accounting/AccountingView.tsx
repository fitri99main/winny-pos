import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Wallet, FileText, Plus, BookOpen, LayoutDashboard, Settings, Edit, Trash2, Download, CalendarCheck, History, Lock, Unlock, Loader2, ShoppingCart, Search, Eye, X, RefreshCw, Printer, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { PettyCashService, PettyCashSession, PettyCashTransaction } from '../../lib/PettyCashService';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DateRangePicker } from '../shared/DateRangePicker';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

// --- Types & Constants ---

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' | 'Label';

interface Account {
    code: string;
    name: string;
    type: AccountType;
    parent_code?: string;
    description?: string;
    order_index?: number;
}

interface JournalEntry {
    id: number;
    date: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    reference_id?: string;
    source_type?: string;
}

// --- Sub-Components ---

// ============================================================
// TAB LAPORAN HPP - Snapshot Harga Pokok Penjualan
// ============================================================
function HppReportTab({ startDate, endDate, currentBranchId, storeSettings }: { startDate: string; endDate: string; currentBranchId: string; storeSettings?: any }) {
    const { permissions, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [productData, setProductData] = useState<any[]>([]);
    const [allRawItems, setAllRawItems] = useState<any[]>([]); // New state for raw transactions
    const [viewMode, setViewMode] = useState<'monthly' | 'product' | 'transactions'>('monthly');
    const [searchProduct, setSearchProduct] = useState('');
    const [searchTransaction, setSearchTransaction] = useState(''); // Search for raw transactions
    const [hppHistory, setHppHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [localStart, setLocalStart] = useState(startDate);
    const [localEnd, setLocalEnd] = useState(endDate);
    const fetchingRef = useRef(false);

    const formatCurrency = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
    const formatPct = (n: number) => isNaN(n) || !isFinite(n) ? '0%' : `${n.toFixed(1)}%`;

    useEffect(() => {
        setLocalStart(startDate);
        setLocalEnd(endDate);
    }, [startDate, endDate]);

    useEffect(() => {
        if (hasLoaded) {
            fetchData();
        }
    }, [localStart, localEnd, currentBranchId, permissions, storeSettings?.sales_view_percentage, authLoading]);

    const fetchData = async () => {
        if (authLoading) return;
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);
        console.log('[HPP] Manual Fetching data for:', { startDate, endDate, currentBranchId });
        try {
            let allItems: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;
            let pageCount = 0;
            const MAX_PAGES = 30; 

            while (hasMore && pageCount < MAX_PAGES) {
                const { data, error } = await supabase
                    .from('sale_items')
                    .select(`
                        id, product_id, product_name, quantity, price, cost, 
                        sales!inner(id, created_at, date, status, branch_id, total_amount, order_no)
                    `)
                    .gte('sales.date', localStart)
                    .lte('sales.date', localEnd)
                    .eq(currentBranchId ? 'sales.branch_id' : 'sales.branch_id', currentBranchId || 'sales.branch_id')
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                
                if (data && data.length > 0) {
                    const statusOkItems = data.filter((item: any) => {
                        const s = item.sales;
                        return ['paid', 'completed', 'selesai', 'served', 'success'].includes((s?.status || '').toLowerCase());
                    });
                    const hasLimit = permissions?.includes('limit_sales_view');
                    const limitPercentage = Number(storeSettings?.sales_view_percentage ?? 70);
                    const filteredItems = hasLimit
                        ? statusOkItems.filter((item: any) => item.sales && (item.sales.id % 100) < limitPercentage)
                        : statusOkItems;
                    allItems = [...allItems, ...filteredItems];
                    if (data.length < pageSize) hasMore = false;
                    else from += pageSize;
                } else {
                    hasMore = false;
                }
                pageCount++;
            }

            const monthMap: Record<string, { revenue: number; hpp: number; count: number }> = {};
            const productMap: Record<string, { revenue: number; hpp: number; qty: number }> = {};

            allItems.forEach((item: any) => {
                const saleDate = item.sales?.date || item.sales?.created_at || '';
                const month = saleDate.substring(0, 7); 
                const qty = Number(item.quantity) || 0;
                const price = Number(item.price) || 0;
                const cost = Number(item.cost) || 0;
                const revenue = qty * price;
                const hpp = qty * cost;

                if (month) {
                    if (!monthMap[month]) monthMap[month] = { revenue: 0, hpp: 0, count: 0 };
                    monthMap[month].revenue += revenue;
                    monthMap[month].hpp += hpp;
                    monthMap[month].count += qty;
                }

                const pName = item.product_name || 'Produk';
                if (!productMap[pName]) productMap[pName] = { revenue: 0, hpp: 0, qty: 0 };
                productMap[pName].revenue += revenue;
                productMap[pName].hpp += hpp;
                productMap[pName].qty += qty;
            });

            setMonthlyData(Object.entries(monthMap).map(([month, d]) => ({ month, ...d, grossProfit: d.revenue - d.hpp, margin: d.revenue > 0 ? ((d.revenue - d.hpp) / d.revenue) * 100 : 0 })).sort((a, b) => a.month.localeCompare(b.month)));
            setProductData(Object.entries(productMap).map(([name, d]) => ({ name, ...d, grossProfit: d.revenue - d.hpp, margin: d.revenue > 0 ? ((d.revenue - d.hpp) / d.revenue) * 100 : 0 })).sort((a, b) => b.grossProfit - a.grossProfit));
            setAllRawItems(allItems.sort((a, b) => (b.sales?.date || '').localeCompare(a.sales?.date || '')));

            // Also fetch recipe HPP change history
            setLoadingHistory(true);
            const { data: histData } = await supabase
                .from('recipe_hpp_history')
                .select('*')
                .order('effective_date', { ascending: false })
                .limit(100);
            setHppHistory(histData || []);
            setLoadingHistory(false);

            setHasLoaded(true);
        } catch (err: any) {
            console.error('[HPP] Error:', err);
            toast.error('Gagal memuat: ' + err.message);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    };

    if (!hasLoaded && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-dashed border-gray-300 animate-in fade-in">
                <TrendingDown className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Laporan Harga Pokok Penjualan (HPP)</h3>
                <p className="text-gray-500 mb-6 text-center max-w-md">Pilih rentang tanggal untuk memproses data HPP snapshot.</p>
                
                <div className="bg-gray-50 p-6 rounded-2xl border mb-8 flex flex-col items-center gap-4">
                    <DateRangePicker 
                        startDate={localStart} 
                        endDate={localEnd} 
                        onChange={(range) => {
                            setLocalStart(range.startDate);
                            setLocalEnd(range.endDate);
                        }} 
                    />
                    <Button onClick={fetchData} className="flex items-center gap-2 px-8 py-6 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20">
                        <Calculator className="w-5 h-5" /> Tampilkan Laporan
                    </Button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="flex flex-col justify-center items-center h-96 bg-white rounded-2xl border shadow-sm"><Loader2 className="animate-spin w-10 h-10 text-primary mb-4" /><p className="text-gray-500 font-medium animate-pulse">Memproses data transaksi...</p></div>;

    const totalRevenue = monthlyData.reduce((s, r) => s + r.revenue, 0);
    const totalHpp = monthlyData.reduce((s, r) => s + r.hpp, 0);
    const totalGross = totalRevenue - totalHpp;
    const avgMargin = totalRevenue > 0 ? (totalGross / totalRevenue) * 100 : 0;

    const filteredProducts = productData.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()));
    const filteredTransactions = allRawItems.filter(item => 
        (item.product_name || '').toLowerCase().includes(searchTransaction.toLowerCase()) ||
        (item.sales?.order_no || '').toLowerCase().includes(searchTransaction.toLowerCase())
    );
    const getMonthLabel = (m: string) => {
        const d = new Date(m + '-01');
        return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    };

    const trendData = monthlyData.map(d => ({
        name: getMonthLabel(d.month),
        hpp: d.hpp,
        margin: Number(d.margin.toFixed(1)),
        revenue: d.revenue
    }));


    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Quick Filter Presets & Date Picker */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">Rentang Cepat:</span>
                    {[
                        { label: 'Hari Ini', days: 0 },
                        { label: '7 Hari', days: 7 },
                        { label: '30 Hari', days: 30 },
                        { label: '90 Hari', days: 90 },
                        { label: 'Tahun Ini', type: 'year' }
                    ].map(p => (
                        <button
                            key={p.label}
                            onClick={() => {
                                const end = new Date();
                                const start = new Date();
                                if (p.type === 'year') {
                                    start.setMonth(0, 1);
                                } else {
                                    start.setDate(end.getDate() - (p.days as number));
                                }
                                setLocalStart(start.toISOString().split('T')[0]);
                                setLocalEnd(end.toISOString().split('T')[0]);
                            }}
                            className="text-[10px] font-bold px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker 
                        startDate={localStart} 
                        endDate={localEnd} 
                        onChange={(range) => {
                            setLocalStart(range.startDate);
                            setLocalEnd(range.endDate);
                        }} 
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Penjualan</p>
                    <p className="text-xl font-black text-gray-800">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total HPP</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(totalHpp)}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm border-green-200">
                    <p className="text-xs font-bold text-green-500 uppercase tracking-wider mb-1">Laba Kotor</p>
                    <p className="text-xl font-black text-green-700">{formatCurrency(totalGross)}</p>
                </div>
                <div className="bg-gradient-to-br from-primary to-orange-600 p-5 rounded-2xl text-white shadow-md">
                    <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Margin Rata-Rata</p>
                    <p className="text-3xl font-black">{formatPct(avgMargin)}</p>
                </div>
            </div>

            {/* Trend Chart Section */}
            {monthlyData.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" /> Visualisasi Tren HPP & Margin
                        </h3>
                        <div className="flex gap-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"></div> HPP</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary"></div> Margin (%)</div>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                <YAxis yAxisId="left" hide />
                                <YAxis yAxisId="right" orientation="right" hide />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any, name: string) => [name === 'hpp' ? formatCurrency(value) : `${value}%`, name === 'hpp' ? 'Total HPP' : 'Margin %']}
                                />
                                <Line yAxisId="left" type="monotone" dataKey="hpp" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                                <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#f97316" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#f97316' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* View Toggle */}
            <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                    <button onClick={() => setViewMode('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'monthly' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>Per Bulan</button>
                    <button onClick={() => setViewMode('product')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'product' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>Per Produk</button>
                    <button onClick={() => setViewMode('transactions')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'transactions' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>Riwayat Detail</button>
                    <button onClick={() => setViewMode('hpp_history' as any)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === ('hpp_history' as any) ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>Log Perubahan HPP</button>
                </div>
                {viewMode === 'product' && (
                    <input
                        type="text"
                        placeholder="Cari produk..."
                        value={searchProduct}
                        onChange={e => setSearchProduct(e.target.value)}
                        className="border rounded-xl px-4 py-2 text-sm flex-1 max-w-xs outline-none focus:ring-2 focus:ring-primary/20"
                    />
                )}
                {viewMode === 'transactions' && (
                    <input
                        type="text"
                        placeholder="Cari produk / no. invoice..."
                        value={searchTransaction}
                        onChange={e => setSearchTransaction(e.target.value)}
                        className="border rounded-xl px-4 py-2 text-sm flex-1 max-w-xs outline-none focus:ring-2 focus:ring-primary/20"
                    />
                )}
                <button 
                    onClick={async () => {
                        if (!confirm('Apakah Anda ingin menyinkronkan HPP untuk periode ini? Sistem akan mengisi HPP yang masih kosong (Rp 0) di transaksi lama berdasarkan harga beli produk saat ini.')) return;
                        setLoading(true);
                        try {
                            const { data: products } = await supabase.from('products').select('id, cost');
                            const { data: allItems } = await supabase
                                .from('sale_items')
                                .select('id, product_id, cost, sales!inner(date)')
                                .gte('sales.date', startDate)
                                .lte('sales.date', endDate)
                                .eq('cost', 0);

                            if (!allItems || allItems.length === 0) {
                                toast.success('Semua transaksi sudah memiliki HPP.');
                                return;
                            }

                            const prodMap: Record<string, number> = {};
                            products?.forEach(p => prodMap[p.id] = p.cost || 0);

                            let updated = 0;
                            for (const item of allItems) {
                                const cost = prodMap[item.product_id];
                                if (cost > 0) {
                                    await supabase.from('sale_items').update({ cost }).eq('id', item.id);
                                    updated++;
                                }
                            }
                            toast.success(`Berhasil menyinkronkan HPP untuk ${updated} item.`);
                            fetchData();
                        } catch (err) {
                            console.error(err);
                            toast.error('Gagal sinkronisasi HPP');
                        } finally {
                            setLoading(false);
                        }
                    }}
                    className="ml-auto text-xs text-orange-600 border border-orange-200 px-3 py-2 rounded-xl hover:bg-orange-50 flex items-center gap-1 font-bold"
                >
                    <RefreshCw className="w-3 h-3" /> Sinkronkan HPP
                </button>
                <button onClick={fetchData} className="text-xs text-gray-400 border px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-1 font-bold">
                    ↻ Refresh
                </button>
            </div>

            {/* Monthly Table */}
            {viewMode === 'monthly' && (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-bold text-gray-800">Laporan HPP per Bulan</h3>
                        <p className="text-xs text-gray-400 mt-1">Angka HPP diambil dari snapshot harga pokok saat transaksi terjadi — tidak akan berubah walau HPP produk diperbarui bulan depan.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                <tr>
                                    <th className="px-4 py-3 text-left">Bulan</th>
                                    <th className="px-4 py-3 text-right">Penjualan</th>
                                    <th className="px-4 py-3 text-right text-red-500">HPP</th>
                                    <th className="px-4 py-3 text-right text-green-600">Laba Kotor</th>
                                    <th className="px-4 py-3 text-right">Margin</th>
                                    <th className="px-4 py-3 text-right">Qty Terjual</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {monthlyData.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">Tidak ada data HPP pada periode ini. Pastikan kolom cost sudah terisi di tabel sale_items.</td></tr>
                                )}
                                {monthlyData.map(row => (
                                    <tr key={row.month} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-bold text-gray-700">{getMonthLabel(row.month)}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.revenue)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">{formatCurrency(row.hpp)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-green-700">{formatCurrency(row.grossProfit)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                row.margin >= 50 ? 'bg-green-100 text-green-700' :
                                                row.margin >= 30 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>{formatPct(row.margin)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500">{Math.round(row.count).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {monthlyData.length > 1 && (
                                <tfoot className="bg-gray-800 text-white font-black">
                                    <tr>
                                        <td className="px-4 py-3">TOTAL</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(totalRevenue)}</td>
                                        <td className="px-4 py-3 text-right text-red-300">{formatCurrency(totalHpp)}</td>
                                        <td className="px-4 py-3 text-right text-green-300">{formatCurrency(totalGross)}</td>
                                        <td className="px-4 py-3 text-right"><span className="px-2 py-1 bg-white/10 rounded-full text-xs">{formatPct(avgMargin)}</span></td>
                                        <td className="px-4 py-3 text-right"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* Product Table */}
            {viewMode === 'product' && (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-bold text-gray-800">Laporan HPP per Produk</h3>
                        <p className="text-xs text-gray-400 mt-1">Diurutkan berdasarkan Laba Kotor tertinggi. Produk dengan margin rendah perlu evaluasi HPP atau harga jual.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                <tr>
                                    <th className="px-4 py-3 text-left">#</th>
                                    <th className="px-4 py-3 text-left">Nama Produk</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3 text-right">Penjualan</th>
                                    <th className="px-4 py-3 text-right text-red-500">HPP</th>
                                    <th className="px-4 py-3 text-right text-green-600">Laba Kotor</th>
                                    <th className="px-4 py-3 text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredProducts.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">Tidak ada data produk ditemukan.</td></tr>
                                )}
                                {filteredProducts.map((row, idx) => (
                                    <tr key={row.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                                        <td className="px-4 py-3 font-bold text-gray-700">{row.name}</td>
                                        <td className="px-4 py-3 text-right text-gray-500">{Math.round(row.qty).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.revenue)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">{formatCurrency(row.hpp)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-green-700">{formatCurrency(row.grossProfit)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                row.margin >= 50 ? 'bg-green-100 text-green-700' :
                                                row.margin >= 30 ? 'bg-yellow-100 text-yellow-700' :
                                                row.hpp === 0 ? 'bg-gray-100 text-gray-400' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {row.hpp === 0 ? 'HPP=0' : formatPct(row.margin)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Transaction Detail Table */}
            {viewMode === 'transactions' && (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-gray-800">Riwayat Snapshot HPP Detail</h3>
                            <p className="text-xs text-gray-400 mt-1">Daftar setiap item yang terjual beserta HPP (cost) yang direkam saat transaksi.</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                <tr>
                                    <th className="px-4 py-3 text-left">Waktu / Invoice</th>
                                    <th className="px-4 py-3 text-left">Produk</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3 text-right">Harga Jual</th>
                                    <th className="px-4 py-3 text-right text-red-500">HPP Unit</th>
                                    <th className="px-4 py-3 text-right text-red-600">Total HPP</th>
                                    <th className="px-4 py-3 text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredTransactions.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">Tidak ada transaksi ditemukan.</td></tr>
                                )}
                                {filteredTransactions.map((item, idx) => {
                                    const cost = Number(item.cost) || 0;
                                    const qty = Number(item.quantity) || 0;
                                    const price = Number(item.price) || 0;
                                    const revenue = qty * price;
                                    const hppTotal = qty * cost;
                                    const margin = revenue > 0 ? ((revenue - hppTotal) / revenue) * 100 : 0;
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-gray-700 text-xs">{item.sales?.date?.substring(0, 16)}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">{item.sales?.order_no}</p>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{item.product_name}</td>
                                            <td className="px-4 py-3 text-right text-gray-600">{qty}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(price)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-red-500">{formatCurrency(cost)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-red-600">{formatCurrency(hppTotal)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    margin >= 50 ? 'bg-green-100 text-green-700' :
                                                    margin >= 30 ? 'bg-yellow-100 text-yellow-700' :
                                                    cost === 0 ? 'bg-gray-100 text-gray-400' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {cost === 0 ? 'HPP=0' : formatPct(margin)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* HPP Change History Table */}
            {viewMode === ('hpp_history' as any) && (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <History className="w-4 h-4 text-primary" /> Log Perubahan HPP & Resep
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">Daftar tanggal kapan resep/HPP diubah untuk menentukan rentang laporan akuntansi.</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                <tr>
                                    <th className="px-6 py-4 text-left">Tgl Berlaku</th>
                                    <th className="px-6 py-4 text-left">Produk</th>
                                    <th className="px-6 py-4 text-right">HPP Lama</th>
                                    <th className="px-6 py-4 text-center"></th>
                                    <th className="px-6 py-4 text-right text-emerald-600">HPP Baru</th>
                                    <th className="px-6 py-4 text-right">Perubahan</th>
                                    <th className="px-6 py-4 text-left">Oleh</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {hppHistory.length === 0 && (
                                    <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Belum ada riwayat perubahan HPP yang tercatat.</td></tr>
                                )}
                                {hppHistory.map((log, idx) => {
                                    const diff = Number(log.new_cost || 0) - Number(log.old_cost || 0);
                                    const diffPct = Number(log.old_cost || 0) > 0 ? (diff / Number(log.old_cost)) * 100 : 0;
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                    <span className="font-bold text-gray-700">{log.effective_date}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-gray-800">{log.product_name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-500 font-mono">Rp {Number(log.old_cost || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center text-gray-300">→</td>
                                            <td className="px-6 py-4 text-right text-emerald-600 font-black font-mono text-base">Rp {Number(log.new_cost || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black ${diff > 0 ? 'bg-red-50 text-red-600' : (diff < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400')}`}>
                                                    {diff > 0 ? '+' : ''}{diff.toLocaleString()} ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 text-xs">{log.changed_by || 'System'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function JournalTab({ transactions, accounts, onAddTransaction, onDeleteTransaction, onResetTransactions, onRefresh, role, searchQuery = '', onSearchChange }: {
    transactions: JournalEntry[],
    accounts: Account[],
    onAddTransaction: (tx: JournalEntry) => void,
    onDeleteTransaction: (id: number) => void,
    onResetTransactions: () => void;
    onRefresh?: () => void;
    role?: string;
    searchQuery?: string;
    onSearchChange?: (val: string) => void;
}) {
    const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0] || '');
    const [journalDesc, setJournalDesc] = useState('');
    const [rows, setRows] = useState([
        { id: Date.now(), account: '', debit: '', credit: '' },
        { id: Date.now() + 1, account: '', debit: '', credit: '' }
    ]);

    const handleAddRow = () => {
        setRows([...rows, { id: Date.now(), account: '', debit: '', credit: '' }]);
    };

    const handleRowChange = (id: number, field: string, value: string) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleRemoveRow = (id: number) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const totalDebit = rows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
    const totalCredit = rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
    const isBalanced = totalDebit === totalCredit && totalDebit > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!journalDate || !journalDesc) {
            toast.error('Mohon isi tanggal dan keterangan jurnal');
            return;
        }
        if (!isBalanced) {
            toast.error('Jurnal belum seimbang atau masih kosong!');
            return;
        }
        if (rows.some(r => !r.account && (Number(r.debit) > 0 || Number(r.credit) > 0))) {
            toast.error('Semua baris yang memiliki nominal harus memilih akun');
            return;
        }

        const debits = rows.filter(r => Number(r.debit) > 0).map(r => ({ account: r.account, amount: Number(r.debit) }));
        const credits = rows.filter(r => Number(r.credit) > 0).map(r => ({ account: r.account, amount: Number(r.credit) }));

        let i = 0, j = 0;
        let success = false;
        while (i < debits.length && j < credits.length) {
            const d = debits[i];
            const c = credits[j];
            const amount = Math.min(d.amount, c.amount);

            const newTx: JournalEntry = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                date: journalDate,
                description: journalDesc,
                debitAccount: d.account,
                creditAccount: c.account,
                amount: amount,
            };

            onAddTransaction(newTx);
            success = true;

            d.amount -= amount;
            c.amount -= amount;

            if (d.amount === 0) i++;
            if (c.amount === 0) j++;
        }
        
        if (success) {
            setRows([
                { id: Date.now(), account: '', debit: '', credit: '' },
                { id: Date.now() + 1, account: '', debit: '', credit: '' }
            ]);
            setJournalDesc('');
            toast.success('Jurnal berhasil disimpan');
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Yakin ingin menghapus jurnal ini?')) {
            onDeleteTransaction(id);
        }
    };

    const handleReset = () => {
        if (confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA data jurnal? Tindakan ini tidak dapat dibatalkan.')) {
            const doubleCheck = prompt('Ketik "HAPUS" untuk konfirmasi reset database:');
            if (doubleCheck === 'HAPUS') {
                onResetTransactions();
            }
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in">
            {/* Input Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" /> Input Jurnal Baru
                </h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                            <input type="date" className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors" value={journalDate} onChange={e => setJournalDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                            <input type="text" className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors" placeholder="Contoh: Pembayaran Gaji" value={journalDesc} onChange={e => setJournalDesc(e.target.value)} />
                        </div>
                    </div>
                    
                    <div className="border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left w-1/2">Akun</th>
                                    <th className="px-4 py-3 text-right w-1/4">Debit</th>
                                    <th className="px-4 py-3 text-right w-1/4">Kredit</th>
                                    <th className="px-4 py-3 text-center w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rows.map((row, idx) => (
                                    <tr key={row.id}>
                                        <td className="p-2">
                                            <select 
                                                className="w-full p-2 border-0 bg-transparent outline-none focus:ring-0" 
                                                value={row.account} 
                                                onChange={e => handleRowChange(row.id, 'account', e.target.value)}
                                            >
                                                <option value="" disabled>Pilih akun...</option>
                                                {accounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border-0 bg-transparent outline-none focus:ring-0 text-right" 
                                                placeholder="0"
                                                value={row.debit} 
                                                onChange={e => {
                                                    handleRowChange(row.id, 'debit', e.target.value);
                                                    if (e.target.value) handleRowChange(row.id, 'credit', '');
                                                }} 
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border-0 bg-transparent outline-none focus:ring-0 text-right" 
                                                placeholder="0"
                                                value={row.credit} 
                                                onChange={e => {
                                                    handleRowChange(row.id, 'credit', e.target.value);
                                                    if (e.target.value) handleRowChange(row.id, 'debit', '');
                                                }} 
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => handleRemoveRow(row.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold">
                                <tr>
                                    <td className="px-4 py-4 text-center">TOTAL</td>
                                    <td className="px-4 py-4 text-right">Rp {totalDebit.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-right">Rp {totalCredit.toLocaleString()}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <button 
                            type="button" 
                            onClick={handleAddRow}
                            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Tambah Baris
                        </button>
                        
                        <div className="flex items-center gap-4">
                            {!isBalanced && (
                                <span className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
                                    Belum Seimbang
                                </span>
                            )}
                            {isBalanced && (
                                <span className="px-4 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium">
                                    Seimbang
                                </span>
                            )}
                            <Button type="submit" disabled={!isBalanced} className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Simpan Jurnal
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Journal Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <h3 className="font-bold text-gray-800 whitespace-nowrap">Riwayat Jurnal Umum</h3>
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Cari akun atau keterangan..."
                                className="w-full pl-9 pr-4 py-1.5 bg-white border rounded-lg text-xs focus:ring-2 focus:ring-primary/20"
                                value={searchQuery}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => onSearchChange?.('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-3 h-3 text-gray-400" />
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Fallback: Allow if role is missing (undefined/null/empty) OR if Administrator/Owner */}
                    {(!role || ['administrator', 'owner'].includes(role.toLowerCase())) && (
                        <button
                            onClick={handleReset}
                            className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-lg hover:bg-red-200 transition-colors font-bold flex items-center gap-1"
                        >
                            <Trash2 className="w-3 h-3" /> Reset Database
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Tgl</th>
                                <th className="px-4 py-3 text-left">Keterangan</th>
                                <th className="px-4 py-3 text-left">Akun</th>
                                <th className="px-4 py-3 text-right">Debit</th>
                                <th className="px-4 py-3 text-right">Kredit</th>
                                {(!role || ['administrator', 'owner'].includes(role.toLowerCase())) && <th className="px-4 py-3 text-center">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice().reverse().map(tx => {
                                const debitName = accounts.find(a => a.code === tx.debitAccount)?.name;
                                const creditName = accounts.find(a => a.code === tx.creditAccount)?.name;
                                return (
                                    <tr key={tx.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 align-top">{tx.date}</td>
                                        <td className="px-4 py-3 align-top font-medium">{tx.description}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-green-700">{tx.debitAccount} - {debitName}</div>
                                            <div className="text-red-700 pl-4">{tx.creditAccount} - {creditName}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right align-top">
                                            <div>Rp {tx.amount.toLocaleString()}</div>
                                            <div className="text-transparent">-</div>
                                        </td>
                                        <td className="px-4 py-3 text-right align-top">
                                            <div className="text-transparent">-</div>
                                            <div>Rp {tx.amount.toLocaleString()}</div>
                                        </td>
                                        {(!role || ['administrator', 'owner'].includes(role.toLowerCase())) && (
                                            <td className="px-4 py-3 text-center align-top">
                                                <button
                                                    onClick={() => handleDelete(tx.id)}
                                                    className="p-1 hover:bg-red-50 text-red-500 rounded text-xs"
                                                    title="Hapus Jurnal"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function PettyCashTab({ branchId, userId, purchases = [], startDate, endDate, onAddTransaction, accounts }: { 
    branchId: string, 
    userId?: string, 
    purchases?: any[], 
    startDate: string, 
    endDate: string,
    onAddTransaction: (tx: JournalEntry) => void,
    accounts: Account[]
}) {
    const [activeSession, setActiveSession] = useState<PettyCashSession | null>(null);
    const [history, setHistory] = useState<PettyCashSession[]>([]);
    const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
    const [viewingPastSession, setViewingPastSession] = useState<PettyCashSession | null>(null);
    const [pastTransactions, setPastTransactions] = useState<PettyCashTransaction[]>([]);
    const [loadingPastTxs, setLoadingPastTxs] = useState(false);
    const [loading, setLoading] = useState(true);
    const [openingAmount, setOpeningAmount] = useState('');
    const [manualData, setManualData] = useState({ type: 'SPEND', amount: '', desc: '' });
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [adjustedBalance, setAdjustedBalance] = useState('');
    const [editingTx, setEditingTx] = useState<PettyCashTransaction | null>(null);
    const [editTxData, setEditTxData] = useState({ type: 'SPEND', amount: '', description: '' });
    const [isClosing, setIsClosing] = useState(false);
    const [closingAmount, setClosingAmount] = useState('');
    const [viewingPurchaseItems, setViewingPurchaseItems] = useState<any>(null);
    const [sourceAccount, setSourceAccount] = useState('102'); // Default to Bank

    const fetchData = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const session = await PettyCashService.getActiveSession(branchId);
            setActiveSession(session);
            if (session) {
                const txs = await PettyCashService.getTransactions(session.id);
                setTransactions(txs);
            }
            const pastSessions = await PettyCashService.getSessionsReport(branchId, startDate, endDate);
            setHistory(pastSessions);
        } catch (error) {
            console.error('Error fetching petty cash:', error);
            toast.error('Gagal memuat data Kas Kecil');
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenSession = async () => {
        if (!openingAmount || isNaN(Number(openingAmount))) {
            toast.error('Nominal saldo real awal tidak valid');
            return;
        }
        try {
            await PettyCashService.openSession(branchId, Number(openingAmount), userId);
            
            // AUTOMATED JOURNAL ENTRY: Debit Petty Cash, Credit Source (Bank/Cash)
            onAddTransaction({
                id: Date.now(),
                date: new Date().toISOString().split('T')[0],
                description: `Pembukaan Saldo Kas Kecil (Shift/Harian)`,
                debitAccount: '105',
                creditAccount: sourceAccount,
                amount: Number(openingAmount)
            });

            toast.success('Saldo Kas Kecil dibuka & Jurnal dicatat');
            setOpeningAmount('');
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Gagal membuka Saldo');
        }
    };

    const handleCloseSession = async () => {
        if (!activeSession) return;
        setClosingAmount(String(activeSession.expected_balance));
        setIsClosing(true);
    };

    const handleFinalClose = async () => {
        if (!activeSession) return;
        try {
            const finalPhysical = Number(closingAmount);
            if (isNaN(finalPhysical)) {
                toast.error('Nominal tidak valid');
                return;
            }

            const variance = finalPhysical - activeSession.expected_balance;

            // 1. If there's a difference, create a correction transaction first in petty cash records
            if (variance !== 0) {
                await PettyCashService.setBalance(
                    activeSession.id, 
                    activeSession.expected_balance, 
                    finalPhysical
                );

                // AUTOMATED JOURNAL ENTRY: Record Variance
                onAddTransaction({
                    id: Date.now(),
                    date: new Date().toISOString().split('T')[0],
                    description: `Penyesuaian Selisih Kas Kecil (${variance > 0 ? 'Surplus' : 'Defisit'})`,
                    debitAccount: variance > 0 ? '105' : '505',
                    creditAccount: variance > 0 ? '402' : '105',
                    amount: Math.abs(variance)
                });
            }

            // 2. Close the session
            await PettyCashService.closeSession(activeSession.id, finalPhysical);
            
            toast.success('Saldo Kas Kecil telah ditutup & Jurnal selisih dicatat');
            setIsClosing(false);
            fetchData();
        } catch (error) {
            toast.error('Gagal menutup Saldo');
        }
    };

    const handleSetBalance = async () => {
        if (!activeSession || !adjustedBalance) return;
        try {
            await PettyCashService.setBalance(activeSession.id, activeSession.expected_balance, Number(adjustedBalance));
        toast.success('Saldo Real diperbarui');
            setIsAdjusting(false);
            setAdjustedBalance('');
            fetchData();
        } catch (error) {
            toast.error('Gagal menyesuaikan saldo');
        }
    };

    const handleDeleteTransaction = async (id: number) => {
        if (!confirm('Hapus transaksi ini? Saldo akan dikalkulasi ulang otomatis.')) return;
        try {
            await PettyCashService.deleteTransaction(id);
            toast.success('Transaksi dihapus');
            fetchData();
        } catch (error) {
            toast.error('Gagal menghapus transaksi');
        }
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTx) return;
        try {
            await PettyCashService.updateTransaction(editingTx.id, {
                type: editTxData.type as any,
                amount: Number(editTxData.amount),
                description: editTxData.description
            });
            toast.success('Transaksi diperbarui');
            setEditingTx(null);
            fetchData();
        } catch (error) {
            toast.error('Gagal memperbarui transaksi');
        }
    };

    const handleDeleteSession = async (id: number) => {
        if (!confirm('HAPUS RIWAYAT SESI INI?\nSeluruh data transaksi di dalam sesi ini juga akan dihapus permanen.')) return;
        try {
            await PettyCashService.deleteSession(id);
            toast.success('Riwayat sesi dihapus');
            fetchData();
        } catch (error) {
            toast.error('Gagal menghapus riwayat');
        }
    };

    const handleViewPastDetails = async (session: PettyCashSession) => {
        setViewingPastSession(session);
        setLoadingPastTxs(true);
        try {
            const txs = await PettyCashService.getTransactions(session.id);
            setPastTransactions(txs);
        } catch (error) {
            toast.error('Gagal memuat transaksi detail');
        } finally {
            setLoadingPastTxs(false);
        }
    };

    const exportPettyCashToExcel = () => {
        try {
            const data = history.map(s => {
                const variance = (s.actual_closing_balance || 0) - s.expected_balance;
                return {
                    'Tanggal': s.date,
                    'Status': s.status.toUpperCase(),
                    'Saldo Awal': s.opening_balance,
                    'Saldo Sistem (Akhir)': s.expected_balance,
                    'Saldo Fisik (Laci)': s.actual_closing_balance || '-',
                    'Selisih': s.status === 'closed' ? variance : 0,
                    'Keterangan Selisih': variance === 0 ? 'Pas' : (variance > 0 ? 'Surplus' : 'Defisit')
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Kas Kecil");
            XLSX.writeFile(workbook, `Laporan_Kas_Kecil_${startDate}_to_${endDate}.xlsx`);
            toast.success('Laporan Kas Kecil berhasil diunduh (Excel)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const exportPettyCashToPDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('LAPORAN RIWAYAT KAS KECIL', 105, 20, { align: 'center' });
            doc.setFontSize(11);
            doc.text(`Periode: ${startDate} s/d ${endDate}`, 105, 28, { align: 'center' });

            const body = history.map(s => {
                const variance = (s.actual_closing_balance || 0) - s.expected_balance;
                return [
                    s.date,
                    s.status.toUpperCase(),
                    `Rp ${s.opening_balance.toLocaleString()}`,
                    `Rp ${s.expected_balance.toLocaleString()}`,
                    s.actual_closing_balance ? `Rp ${s.actual_closing_balance.toLocaleString()}` : '-',
                    `Rp ${variance.toLocaleString()}`
                ];
            });

            autoTable(doc, {
                startY: 40,
                head: [['Tgl', 'Status', 'Awal', 'Sistem', 'Fisik', 'Selisih']],
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [234, 88, 12] }
            });

            doc.save(`Laporan_Kas_Kecil_${startDate}_to_${endDate}.pdf`);
            toast.success('Laporan Kas Kecil berhasil diunduh (PDF)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const handleAddManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSession) return;
        if (!manualData.amount || isNaN(Number(manualData.amount)) || !manualData.desc) {
            toast.error('Mohon lengkapi nominal dan keterangan');
            return;
        }

        try {
            await PettyCashService.addTransaction({
                session_id: activeSession.id,
                type: manualData.type as 'TOPUP' | 'SPEND',
                amount: Number(manualData.amount),
                description: manualData.desc,
                reference_type: 'manual'
            });
            toast.success('Transaksi manual berhasil dicatat');
            setManualData({ ...manualData, amount: '', desc: '' });
            fetchData();
        } catch (error) {
            toast.error('Gagal mencatat transaksi');
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            {!activeSession ? (
                <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border text-center">
                    <Unlock className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-800">Buka Saldo Kas Kecil</h3>
                    <p className="text-gray-500 mb-6 text-sm">Masukan nominal dana yang diambil untuk operasional harian.</p>
                    <div className="space-y-4">
                        <div className="text-left">
                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">Sumber Dana (Ambil Dari)</label>
                            <select 
                                className="w-full p-3 border rounded-xl text-sm"
                                value={sourceAccount}
                                onChange={e => setSourceAccount(e.target.value)}
                            >
                                <option value="102">102 - Bank</option>
                                <option value="101">101 - Kas (Besar)</option>
                            </select>
                        </div>
                        <input
                            type="number"
                            className="w-full p-3 border rounded-xl text-center text-xl font-bold bg-gray-50"
                            placeholder="Rp 0"
                            value={openingAmount}
                            onChange={e => setOpeningAmount(e.target.value)}
                        />
                        <Button onClick={handleOpenSession} className="w-full py-6 text-lg tracking-wide">Buka Saldo Hari Ini</Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Status & Closing */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 bg-gradient-to-br from-white to-orange-50/30">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-orange-100 rounded-xl"><Wallet className="w-6 h-6 text-orange-600" /></div>
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider">Aktif</span>
                        </div>
                        <p className="text-gray-500 text-sm">Saldo Real Saat Ini</p>
                        <h3 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                           Rp {activeSession.expected_balance.toLocaleString()}
                           {!isAdjusting && (
                               <button onClick={() => { setIsAdjusting(true); setAdjustedBalance(String(activeSession.expected_balance)); }} className="p-1 hover:bg-orange-100 rounded text-orange-400">
                                   <Edit className="w-4 h-4" />
                               </button>
                           )}
                        </h3>

                        {isAdjusting ? (
                            <div className="space-y-3 mb-6 p-3 bg-orange-100/50 rounded-xl border border-orange-200">
                                <label className="block text-[10px] uppercase font-bold text-orange-600">Koreksi Saldo Real</label>
                                <input 
                                    type="number"
                                    className="w-full p-2 border rounded-lg text-sm font-bold"
                                    value={adjustedBalance}
                                    onChange={e => setAdjustedBalance(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSetBalance} className="flex-1">Simpan</Button>
                                    <Button size="sm" variant="outline" onClick={() => setIsAdjusting(false)} className="flex-1">Batal</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 pt-6 border-t border-orange-100">
                                <Button variant="outline" onClick={handleCloseSession} className="w-full border-orange-200 text-orange-600 hover:bg-orange-50">Tutup Saldo Hari Ini</Button>
                            </div>
                        )}
                    </div>

                    {/* Today's Transactions */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Aliran Dana Hari Ini</h3>
                            <span className="text-xs text-gray-400">{new Date(activeSession.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        
                        {/* Manual Transaction Form */}
                        <div className="p-4 bg-gray-50/50 border-b">
                            <form onSubmit={handleAddManual} className="flex flex-wrap items-end gap-3">
                                <div className="w-32">
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Tipe</label>
                                    <select 
                                        className="w-full text-xs p-2 border rounded-lg"
                                        value={manualData.type}
                                        onChange={e => setManualData({...manualData, type: e.target.value})}
                                    >
                                        <option value="TOPUP">TOP UP</option>
                                        <option value="SPEND">KELUAR</option>
                                    </select>
                                </div>
                                <div className="w-40">
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Nominal (Rp)</label>
                                    <input 
                                        type="number" 
                                        className="w-full text-xs p-2 border rounded-lg"
                                        placeholder="0"
                                        value={manualData.amount}
                                        onChange={e => setManualData({...manualData, amount: e.target.value})}
                                    />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Keterangan</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs p-2 border rounded-lg"
                                        placeholder="Contoh: Beli Bensin, Uang Makan"
                                        value={manualData.desc}
                                        onChange={e => setManualData({...manualData, desc: e.target.value})}
                                    />
                                </div>
                                <Button type="submit" size="sm" className="px-6 h-9">Catat Transaksi</Button>
                            </form>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Waktu</th>
                                        <th className="px-4 py-3 text-left">Keterangan</th>
                                        <th className="px-4 py-3 text-right">Masuk</th>
                                        <th className="px-4 py-3 text-right">Keluar</th>
                                        <th className="px-4 py-3 text-right">Saldo</th>
                                        <th className="px-4 py-3 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // Calculate running balances
                                        // Start from opening_balance
                                        // Sort transactions by created_at ascending to calculate correctly
                                        const sorted = [...transactions].sort((a, b) => 
                                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                                        );
                                        
                                        let currentRunning = activeSession.opening_balance;
                                        const txsWithBalance = sorted.map(tx => {
                                            if (tx.type === 'TOPUP') currentRunning += tx.amount;
                                            else currentRunning -= tx.amount;
                                            return { ...tx, runningBalance: currentRunning };
                                        });

                                        // Display them (usually newest at top)
                                        return txsWithBalance.reverse().map(tx => (
                                            <tr key={tx.id} className="border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-400">{new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-800">{tx.description}</div>
                                                    {tx.reference_type === 'purchase' && (
                                                        <button 
                                                            onClick={() => {
                                                                const p = purchases.find(p => p.purchase_no === tx.reference_id);
                                                                if (p) setViewingPurchaseItems(p);
                                                                else toast.error('Detail item tidak ditemukan');
                                                            }}
                                                            className="text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-1 mt-1"
                                                        >
                                                            <Eye className="w-3 h-3" /> LIHAT RINCIAN BARANG
                                                        </button>
                                                    )}
                                                    {tx.reference_type && tx.reference_type !== 'purchase' && (
                                                        <div className="text-[10px] text-gray-400 uppercase">{tx.reference_type}: {tx.reference_id}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-green-600 font-bold">{tx.type === 'TOPUP' ? `Rp ${tx.amount.toLocaleString()}` : '-'}</td>
                                                <td className="px-4 py-3 text-right text-red-600 font-bold">{tx.type === 'SPEND' ? `Rp ${tx.amount.toLocaleString()}` : '-'}</td>
                                                <td className="px-4 py-3 text-right font-black text-gray-900 bg-gray-50/30">Rp {tx.runningBalance.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center gap-1">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingTx(tx);
                                                                setEditTxData({ type: tx.type, amount: String(tx.amount), description: tx.description });
                                                            }}
                                                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ));
                                    })()}
                                    {transactions.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">Belum ada transaksi</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* History Table */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-gray-800"><History className="w-4 h-4 text-orange-600" /> Riwayat Kas Kecil</h3>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white border-green-200 text-green-700 hover:bg-green-50 flex items-center gap-1"
                            onClick={exportPettyCashToExcel}
                        >
                            <Download className="w-3 h-3" /> Excel
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-1"
                            onClick={exportPettyCashToPDF}
                        >
                            <FileText className="w-3 h-3" /> PDF
                        </Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left">Tanggal</th>
                                <th className="px-4 py-3 text-right">Awal</th>
                                <th className="px-4 py-3 text-right">Sistem (Akhir)</th>
                                <th className="px-4 py-3 text-right">Fisik (Laci)</th>
                                <th className="px-4 py-3 text-right">Selisih</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(session => (
                                <tr key={session.id} className="border-b hover:bg-gray-50 group">
                                    <td className="px-4 py-3 font-medium">{new Date(session.date).toLocaleDateString('id-ID')}</td>
                                    <td className="px-4 py-3 text-right text-gray-500">Rp {session.opening_balance.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-600 font-mono">
                                        Rp {session.expected_balance.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-600">
                                        {session.actual_closing_balance !== null ? `Rp ${session.actual_closing_balance.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black">
                                        {session.status === 'closed' && session.actual_closing_balance !== null ? (
                                            (() => {
                                                const variance = session.actual_closing_balance - session.expected_balance;
                                                return (
                                                    <span className={variance === 0 ? 'text-gray-300' : 'text-red-600'}>
                                                        {variance !== 0 ? (variance > 0 ? '+' : '') : ''}
                                                        Rp {variance.toLocaleString()}
                                                        {variance !== 0 && <span className="ml-1">⚠️</span>}
                                                    </span>
                                                );
                                            })()
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${session.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {session.status === 'open' ? 'OPEN' : 'CLOSED'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => handleViewPastDetails(session)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Lihat Rincian Transaksi">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteSession(session.id)} className="p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Past Session Modal */}
            {viewingPastSession && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Rincian Kas Kecil</h3>
                                <p className="text-sm text-gray-500">{new Date(viewingPastSession.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                            <button onClick={() => setViewingPastSession(null)} className="text-gray-400 hover:text-gray-600 p-2 bg-gray-100 rounded-full">✕</button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Saldo Awal</p>
                                <p className="text-sm font-bold">Rp {viewingPastSession.opening_balance.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Saldo Sistem</p>
                                <p className="text-sm font-bold">Rp {viewingPastSession.expected_balance.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Saldo Fisik</p>
                                <p className="text-sm font-bold text-blue-600">Rp {viewingPastSession.actual_closing_balance?.toLocaleString() || '-'}</p>
                            </div>
                            <div className="p-3 bg-red-50 rounded-xl">
                                <p className="text-[10px] text-red-400 font-bold uppercase">Selisih</p>
                                <p className="text-sm font-bold text-red-600">
                                    Rp {((viewingPastSession.actual_closing_balance || 0) - viewingPastSession.expected_balance).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2">
                            {loadingPastTxs ? (
                                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 sticky top-0 font-bold text-gray-500">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Waktu</th>
                                            <th className="px-3 py-2 text-left">Keterangan</th>
                                            <th className="px-3 py-2 text-right">Masuk</th>
                                            <th className="px-3 py-2 text-right">Keluar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {pastTransactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-gray-400">{new Date(tx.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}</td>
                                                <td className="px-3 py-2 font-medium">{tx.description}</td>
                                                <td className="px-3 py-2 text-right text-green-600">{tx.type === 'TOPUP' ? `Rp ${tx.amount.toLocaleString()}` : '-'}</td>
                                                <td className="px-3 py-2 text-right text-red-600">{tx.type === 'SPEND' ? `Rp ${tx.amount.toLocaleString()}` : '-'}</td>
                                            </tr>
                                        ))}
                                        {pastTransactions.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">Tidak ada rincian transaksi</td></tr>}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {editingTx && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Edit Transaksi</h3>
                            <button onClick={() => setEditingTx(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleUpdateTransaction} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tipe</label>
                                <select 
                                    className="w-full p-3 border rounded-xl"
                                    value={editTxData.type}
                                    onChange={e => setEditTxData({...editTxData, type: e.target.value})}
                                >
                                    <option value="TOPUP">TOP UP / MASUK</option>
                                    <option value="SPEND">KELUAR / BELANJA</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nominal</label>
                                <input 
                                    type="number"
                                    className="w-full p-3 border rounded-xl font-bold"
                                    value={editTxData.amount}
                                    onChange={e => setEditTxData({...editTxData, amount: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Keterangan</label>
                                <input 
                                    type="text"
                                    className="w-full p-3 border rounded-xl"
                                    value={editTxData.description}
                                    onChange={e => setEditTxData({...editTxData, description: e.target.value})}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setEditingTx(null)} className="flex-1">Batal</Button>
                                <Button type="submit" className="flex-1">Simpan Perubahan</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Closing Reconciliation Modal */}
            {isClosing && activeSession && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 text-center">Tutup Saldo Kas Kecil</h3>
                            <button onClick={() => setIsClosing(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="space-y-6">
                            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                <p className="text-xs font-bold text-orange-600 uppercase mb-1">Saldo Kas di Sistem</p>
                                <p className="text-2xl font-black text-orange-700">Rp {activeSession.expected_balance.toLocaleString()}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">Total Uang Fisik di Laci (Real)</label>
                                <input 
                                    type="number"
                                    className="w-full p-4 border rounded-2xl text-2xl font-black text-center focus:ring-2 focus:ring-primary shadow-inner bg-gray-50"
                                    value={closingAmount}
                                    onChange={e => setClosingAmount(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-[10px] text-gray-400 italic text-center">Input jumlah uang asli yang Anda pegang saat ini.</p>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-sm text-gray-500">Selisih:</span>
                                    <span className={`text-lg font-bold ${(Number(closingAmount) - activeSession.expected_balance) === 0 ? 'text-gray-400' : 'text-red-600'}`}>
                                        Rp {(Number(closingAmount) - activeSession.expected_balance).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="ghost" onClick={() => setIsClosing(false)} className="flex-1">Batal</Button>
                                    <Button onClick={handleFinalClose} className="flex-1 bg-orange-600 hover:bg-orange-700">Selesai & Tutup Saldo</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Purchase Items Shortcut Modal */}
            {viewingPurchaseItems && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-black text-gray-800">Rincian Barang: {viewingPurchaseItems.purchase_no}</h3>
                                <p className="text-sm text-gray-500">Supplier: {viewingPurchaseItems.supplier_name}</p>
                            </div>
                            <button onClick={() => setViewingPurchaseItems(null)} className="text-gray-400 hover:text-gray-600 p-2 bg-gray-100 rounded-full">✕</button>
                        </div>
                        
                        <div className="max-h-[50vh] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Barang</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Harga</th>
                                        <th className="px-4 py-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(viewingPurchaseItems.items_list || []).map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-3 font-medium">{item.name}</td>
                                            <td className="px-4 py-3 text-center">{item.quantity} {item.unit}</td>
                                            <td className="px-4 py-3 text-right">Rp {item.price?.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-bold">Rp {(item.price * item.quantity).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 pt-4 border-t flex justify-between font-black text-lg">
                            <span>TOTAL</span>
                            <span className="text-primary">Rp {viewingPurchaseItems.total_amount?.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PurchaseHistoryTab({ purchases, onCRUD }: { 
    purchases: any[], 
    onCRUD: (table: string, action: 'create' | 'update' | 'delete', data: any) => Promise<void> 
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingPurchase, setViewingPurchase] = useState<any>(null);
    const [editingPurchase, setEditingPurchase] = useState<any>(null);

    const filtered = useMemo(() => {
        return purchases.filter(p => 
            p.purchase_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [purchases, searchQuery]);

    const handleDelete = async (id: any) => {
        if (confirm('Anda yakin ingin menghapus data pembelian ini? Tindakan ini tidak dapat dibatalkan.')) {
            try {
                await onCRUD('purchases', 'delete', { id });
                toast.success('Pembelian berhasil dihapus');
            } catch (error) {
                toast.error('Gagal menghapus pembelian');
            }
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onCRUD('purchases', 'update', editingPurchase);
            toast.success('Data pembelian diperbarui');
            setEditingPurchase(null);
        } catch (error) {
            toast.error('Gagal memperbarui data');
        }
    };

    const flatPurchases = useMemo(() => {
        const rows: any[] = [];
        filtered.forEach(p => {
            const items = p.items_list || [];
            if (items.length === 0) {
                rows.push({ ...p, itemName: '-', itemPrice: 0, itemQty: 0, itemUnit: '-', isFirst: true });
            } else {
                items.forEach((item: any, idx: number) => {
                    rows.push({
                        ...p,
                        itemName: item.name,
                        itemPrice: item.price,
                        itemQty: item.quantity,
                        itemUnit: item.unit || '-',
                        isFirst: idx === 0
                    });
                });
            }
        });
        return rows;
    }, [filtered]);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header / Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Cari PO atau Supplier..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button 
                    variant="default" 
                    size="sm" 
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-black shadow-lg shadow-orange-200 animate-pulse-subtle"
                    onClick={async () => {
                        const loadingToast = toast.loading('Mensinkronkan data ke Neraca...');
                        try {
                            if (onCRUD) {
                                await onCRUD('purchases', 'update', { id: 'SYNC_ALL' });
                            }
                            toast.success('Sinkronisasi Neraca Berhasil', { id: loadingToast });
                        } catch (e) {
                            toast.error('Gagal Sinkronisasi', { id: loadingToast });
                        }
                    }}
                >
                    <RefreshCw className="w-4 h-4" /> SINKRONKAN KE NERACA
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold">
                            <tr>
                                <th className="px-6 py-4 text-left">No. Faktur</th>
                                <th className="px-6 py-4 text-left">Tanggal</th>
                                <th className="px-6 py-4 text-left">Supplier</th>
                                <th className="px-6 py-4 text-center">Metode</th>
                                <th className="px-6 py-4 text-left">Item</th>
                                <th className="px-6 py-4 text-right">Harga</th>
                                <th className="px-6 py-4 text-center">Jumlah</th>
                                <th className="px-6 py-4">kg/satuan</th>
                                <th className="px-6 py-4 text-right">Total</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {flatPurchases.map((p, idx) => (
                                <tr key={`${p.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-blue-600">{p.purchase_no}</td>
                                    <td className="px-6 py-4 text-gray-600">{p.date}</td>
                                    <td className="px-6 py-4 font-bold text-gray-700">{p.supplier_name}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                            p.payment_method === 'Hutang' ? 'bg-red-100 text-red-700' :
                                            p.payment_method === 'Kas Kecil' ? 'bg-amber-100 text-amber-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {p.payment_method || 'Tunai'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">{p.itemName}</td>
                                    <td className="px-6 py-4 text-right">Rp {(p.itemPrice || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center font-bold">{p.itemQty}</td>
                                    <td className="px-6 py-4 text-gray-400">{p.itemUnit}</td>
                                    <td className="px-6 py-4 text-right font-black text-gray-900">Rp {((p.itemPrice || 0) * (p.itemQty || 0)).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            {p.isFirst && (
                                                <>
                                                    <button onClick={() => setViewingPurchase(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Detail Items">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingPurchase(p)} className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100" title="Edit Data">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Hapus">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {flatPurchases.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400 italic">Tidak ada rincian pembelian ditemukan.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Detail Items */}
            {viewingPurchase && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-black text-gray-800">Detail Pembelian: {viewingPurchase.purchase_no}</h3>
                                <p className="text-sm text-gray-500">{viewingPurchase.supplier_name} • {viewingPurchase.date}</p>
                            </div>
                            <button onClick={() => setViewingPurchase(null)} className="text-gray-400 hover:text-gray-600 p-2 bg-gray-100 rounded-full">✕</button>
                        </div>
                        
                        <div className="max-h-[60vh] overflow-y-auto pr-2">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Nama Barang</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Harga Satuan</th>
                                        <th className="px-4 py-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(viewingPurchase.items_list || []).map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-3 text-gray-800 font-medium">{item.name}</td>
                                            <td className="px-4 py-3 text-center text-gray-600">{item.quantity} {item.unit}</td>
                                            <td className="px-4 py-3 text-right text-gray-600">Rp {item.price?.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-800">Rp {(item.price * item.quantity).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-8 pt-6 border-t flex justify-between items-center">
                            <span className="text-gray-500 font-bold">TOTAL PEMBAYARAN</span>
                            <span className="text-2xl font-black text-primary">Rp {viewingPurchase.total_amount?.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Edit Data */}
            {editingPurchase && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-black text-gray-800 mb-6 text-center">Edit Data Induk PO</h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1">Tanggal</label>
                                <input 
                                    type="date" 
                                    className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20"
                                    value={editingPurchase.date}
                                    onChange={e => setEditingPurchase({...editingPurchase, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1">Nama Supplier</label>
                                <input 
                                    className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20"
                                    value={editingPurchase.supplier_name}
                                    onChange={e => setEditingPurchase({...editingPurchase, supplier_name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1">Total Amount (Rp)</label>
                                    <input 
                                        type="number"
                                        className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                                        value={editingPurchase.total_amount}
                                        onChange={e => setEditingPurchase({...editingPurchase, total_amount: Number(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1">Status</label>
                                    <select 
                                        className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20"
                                        value={editingPurchase.status}
                                        onChange={e => setEditingPurchase({...editingPurchase, status: e.target.value})}
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-1">Metode Pembayaran</label>
                                <select 
                                    className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                                    value={editingPurchase.payment_method || 'Tunai'}
                                    onChange={e => setEditingPurchase({...editingPurchase, payment_method: e.target.value})}
                                >
                                    <option value="Tunai">Tunai / Cash</option>
                                    <option value="Transfer">Transfer Bank</option>
                                    <option value="Hutang">Hutang (Credit)</option>
                                    <option value="Kas Kecil">Kas Kecil (Petty Cash)</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-6">
                                <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditingPurchase(null)}>Batal</Button>
                                <Button type="submit" className="flex-1">Simpan</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function AccountManagementTab({ accounts, getBalance, onAddAccount, onUpdateAccount, onDeleteAccount, onMoveAccount, onViewLedger }: {
    accounts: Account[],
    getBalance: (code: string) => number,
    onAddAccount: (acc: Account) => void,
    onUpdateAccount: (acc: Account) => void,
    onDeleteAccount: (code: string) => void,
    onMoveAccount: (acc: Account, dir: 'up' | 'down') => void,
    onViewLedger?: (code: string) => void
}) {
    const [formData, setFormData] = useState<Account>({ code: '', name: '', type: 'Asset', parent_code: '', description: '' });
    const [isEditing, setIsEditing] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) {
            toast.error('Kode dan Nama Akun wajib diisi');
            return;
        }

        if (isEditing) {
            onUpdateAccount(formData);
            toast.success('Akun berhasil diperbarui');
            setIsEditing(false);
        } else {
            // Check formatted code uniqueness
            if (accounts.some(a => a.code === formData.code)) {
                toast.error('Kode akun sudah ada!');
                return;
            }
            onAddAccount(formData);
            toast.success('Akun baru berhasil ditambahkan');
        }
        setFormData({ code: '', name: '', type: 'Asset', parent_code: '', description: '' });
    };

    const handleEdit = (acc: Account) => {
        setFormData(acc);
        setIsEditing(true);
    };

    const handleDelete = (code: string) => {
        if (confirm('Anda yakin ingin menghapus MASTER DATA akun ini?')) {
            onDeleteAccount(code);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" /> {isEditing ? 'Edit Akun' : 'Tambah Akun Baru'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kode Akun</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-lg disabled:bg-gray-100"
                            placeholder="Contoh: 101"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            disabled={isEditing}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Akun</label>
                        <input type="text" className="w-full p-2 border rounded-lg" placeholder="Contoh: Kas Kecil" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Akun</label>
                        <select className="w-full p-2 border rounded-lg" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}>
                            <option value="Asset">Asset (Harta)</option>
                            <option value="Liability">Liability (Kewajiban)</option>
                            <option value="Equity">Equity (Modal)</option>
                            <option value="Income">Income (Pendapatan)</option>
                            <option value="Expense">Expense (Beban)</option>
                            <option value="Label">Label / Sub-Judul (Tanpa Saldo)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (Opsional)</label>
                        <textarea 
                            className="w-full p-2 border rounded-lg resize-none" 
                            rows={2} 
                            placeholder="Tambahkan catatan di sini..." 
                            value={formData.description || ''} 
                            onChange={e => setFormData({ ...formData, description: e.target.value })} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Grup / Induk Akun (Sub-Akun Dari)</label>
                        <select 
                            className="w-full p-2 border rounded-lg" 
                            value={formData.parent_code || ''} 
                            onChange={e => {
                                const pCode = e.target.value;
                                const parent = accounts.find(a => a.code === pCode);
                                setFormData({ 
                                    ...formData, 
                                    parent_code: pCode || undefined,
                                    type: parent ? parent.type : formData.type 
                                });
                            }}
                        >
                            <option value="">-- Akun Utama (Tidak ada Induk) --</option>
                            {accounts
                                .filter(a => a.code !== formData.code)
                                .sort((a,b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.code.localeCompare(b.code))
                                .map(acc => (
                                    <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                                ))
                            }
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1 italic">Pilih induk jika ini adalah bagian dari akun lain (misal: ASET TETAP di bawah ASET).</p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" className="w-full">{isEditing ? 'Simpan Perubahan' : 'Tambah Akun'}</Button>
                        {isEditing && (
                            <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setFormData({ code: '', name: '', type: 'Asset', parent_code: '', description: '' }); }}>Batal</Button>
                        )}
                    </div>
                </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Daftar Akun (Chart of Accounts)</h3>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left">Kode</th>
                                <th className="px-4 py-3 text-left">Nama Akun</th>
                                <th className="px-4 py-3 text-left">Tipe</th>
                                <th className="px-4 py-3 text-right">Saldo</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                // Hierarchical Sorting (Recursive for Multi-level)
                                const buildHierarchy = (parentCode: string | undefined = undefined, level: number = 0): any[] => {
                                    return accounts
                                        .filter(a => (parentCode === undefined ? !a.parent_code : a.parent_code === parentCode))
                                        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.code.localeCompare(b.code))
                                        .reduce((acc: any[], curr) => {
                                            acc.push({ ...curr, level });
                                            const children = buildHierarchy(curr.code, level + 1);
                                            return [...acc, ...children];
                                        }, []);
                                };

                                const hierarchicalAccounts = buildHierarchy();

                                return hierarchicalAccounts.map(acc => {
                                    const hasChildren = accounts.some(a => a.parent_code === acc.code);
                                    const isSubAccount = !!acc.parent_code;
                                    const level = acc.level || 0;
                                    
                                    return (
                                        <tr 
                                            key={acc.code} 
                                            className={`border-b hover:bg-blue-50 cursor-pointer transition-colors font-medium group/row ${hasChildren ? 'bg-blue-50/20' : isSubAccount ? 'bg-gray-50/30' : ''}`}
                                            onClick={() => onViewLedger?.(acc.code)}
                                            title="Klik untuk melihat rincian Buku Besar"
                                        >
                                            <td className={`px-4 py-3 ${hasChildren ? 'font-bold text-primary' : isSubAccount ? 'text-gray-400 italic' : 'text-blue-600'}`} style={{ paddingLeft: `${level * 2 + 1}rem` }}>
                                                {isSubAccount && <span className="mr-2">└</span>}
                                                {acc.code}
                                            </td>
                                            <td className={`px-4 py-3 ${hasChildren ? 'font-black text-gray-900' : acc.type === 'Label' ? 'text-gray-500 italic' : isSubAccount ? 'text-gray-600' : 'font-bold text-gray-800'}`}>
                                                <div className="flex flex-col">
                                                    <span>{acc.name}</span>
                                                    {acc.description && <span className="text-[10px] text-gray-400 italic font-normal">{acc.description}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-[10px] border ${acc.type === 'Asset' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    acc.type === 'Liability' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        acc.type === 'Equity' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            acc.type === 'Income' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                                'bg-orange-50 text-orange-700 border-orange-200'
                                                    }`}>
                                                    {acc.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                Rp {getBalance(acc.code).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 flex justify-center gap-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onMoveAccount(acc, 'up'); }} 
                                                    className="p-1 hover:bg-gray-100 text-gray-400 rounded"
                                                    title="Geser Atas"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onMoveAccount(acc, 'down'); }} 
                                                    className="p-1 hover:bg-gray-100 text-gray-400 rounded"
                                                    title="Geser Bawah"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                                <div className="w-px h-4 bg-gray-100 mx-1 self-center" />
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(acc); }} 
                                                    className="p-1 hover:bg-blue-50 text-blue-600 rounded bg-blue-50/50 border border-blue-100"
                                                    title="Edit Akun"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(acc.code); }}
                                                    className={`p-1 rounded ${getBalance(acc.code) !== 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-red-50 text-red-600'}`}
                                                    disabled={getBalance(acc.code) !== 0}
                                                    title={getBalance(acc.code) !== 0 ? "Tidak bisa hapus akun yang memiliki saldo/transaksi" : "Hapus Master Akun"}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// --- Main Component ---

export interface AccountingViewProps {
    accounts?: Account[];
    transactions?: any[];
    sales?: any[]; // [NEW] Added for direct sync
    storeSettings?: any;
    onAddAccount?: (acc: Account) => Promise<void>;
    onUpdateAccount?: (acc: Account) => Promise<void>;
    onDeleteAccount?: (code: string) => Promise<void>;
    onAddTransaction?: (tx: JournalEntry) => Promise<void>;
    onDeleteTransaction?: (id: number) => Promise<void>;
    onResetTransactions?: () => Promise<void>;
    onRefresh?: () => void;
    onBack?: () => void;
    currentBranchId?: string;
    purchases?: any[];
    onPurchaseCRUD?: (table: string, action: 'create' | 'update' | 'delete', data: any) => Promise<void>;
}

export function AccountingView({
    accounts = [],
    transactions = [],
    sales = [], // [NEW] Added for direct sync
    storeSettings,
    onAddAccount = async () => { },
    onUpdateAccount = async () => { },
    onDeleteAccount = async () => { },
    onAddTransaction = async () => { },
    onDeleteTransaction = async () => { },
    onResetTransactions = async () => { },
    onRefresh,
    onBack,
    currentBranchId = '',
    purchases = [],
    onPurchaseCRUD = async () => { }
}: AccountingViewProps) {
    const { user, role, permissions, loading } = useAuth();

    const [activeTab, setActiveTab] = useState('overview');
    const [journalSearch, setJournalSearch] = useState('');
    const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string | null>(null);
    
    const [realSales, setRealSales] = useState<any[]>([]);
    const [realPurchases, setRealPurchases] = useState<any[]>([]);
    const [isLoadingRealData, setIsLoadingRealData] = useState(false);

    // --- Modal State ---
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [initialTypeForNewAccount, setInitialTypeForNewAccount] = useState<AccountType>('Asset');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // [NEW] Journal CRUD States
    const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
    const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
    const [linkedPurchase, setLinkedPurchase] = useState<any>(null);

    useEffect(() => {
        const fetchLinkedData = async () => {
            if (isJournalModalOpen && editingJournal?.source_type === 'purchase' && editingJournal?.reference_id) {
                const { data } = await supabase.from('purchases').select('*').eq('id', editingJournal.reference_id).maybeSingle();
                setLinkedPurchase(data);
            } else {
                setLinkedPurchase(null);
            }
        };
        fetchLinkedData();
    }, [isJournalModalOpen, editingJournal]);

    const renderPrintRows = (type: AccountType | undefined, parentCode: string | undefined, level: number = 0): React.ReactNode[] => {
        const children = accounts.filter(a => {
            const isMatch = parentCode 
                ? a.parent_code === parentCode 
                : (!a.parent_code || a.parent_code === '');
            
            if (!isMatch) return false;
            if (parentCode) return true;

            if (a.type === 'Label') {
                if (type === 'Asset' && a.code.startsWith('1')) return true;
                if (type === 'Liability' && a.code.startsWith('2')) return true;
                if (type === 'Equity' && a.code.startsWith('3')) return true;
                return false;
            }
            
            return type ? a.type === type : true;
        }).sort((a, b) => a.code.localeCompare(b.code));
        
        return children.flatMap(acc => {
            const balance = getDisplayBalance(acc.code);
            const subHierarchy = renderPrintRows(undefined, acc.code, level + 1);
            const hasChildren = accounts.some(a => a.parent_code === acc.code);
            const isLabel = acc.type === 'Label';

            return [
                <div key={acc.code} className="py-1">
                    <div className="flex justify-between items-center text-[12px]">
                        <span style={{ marginLeft: `${level * 1.5}rem` }} className={`${isLabel || hasChildren ? 'font-bold' : ''}`}>
                            {!isLabel && <span className="text-gray-400 mr-2">{acc.code}</span>}
                            {acc.name}
                        </span>
                        {!isLabel && (
                            <span className={hasChildren ? 'font-bold' : ''}>
                                Rp {balance.toLocaleString()}
                            </span>
                        )}
                    </div>
                    {subHierarchy}
                </div>
            ];
        });
    };

    const renderPrintPreview = () => {
        if (!isPreviewOpen) return null;

        const totalAset = accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalUtang = accounts.filter(a => a.type === 'Liability').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalEkuitasWithoutProfit = accounts.filter(a => a.type === 'Equity').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalEkuitas = totalEkuitasWithoutProfit + netProfit;

        return (
            <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md z-[10000] overflow-y-auto p-4 sm:p-8 flex justify-center">
                <div className="absolute top-4 right-4 flex gap-4">
                    <Button 
                        variant="outline" 
                        className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                        onClick={() => window.print()}
                    >
                        <Printer className="w-4 h-4 mr-2" /> Cetak Sekarang
                    </Button>
                    <Button 
                        variant="outline" 
                        className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                        onClick={() => setIsPreviewOpen(false)}
                    >
                        <X className="w-4 h-4 mr-2" /> Tutup
                    </Button>
                </div>

                <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-[0_0_50px_rgba(0,0,0,0.5)] p-[20mm] print:shadow-none print:p-0 animate-in fade-in zoom-in-95 duration-300">
                    {/* Paper Content */}
                    <div className="border-b-4 border-black pb-6 mb-8 text-center">
                        <h1 className="text-3xl font-serif font-bold tracking-tight">LAPORAN POSISI KEUANGAN</h1>
                        <p className="text-lg font-serif mt-1 uppercase tracking-widest text-gray-600">WinPOS Enterprise Edition</p>
                        <div className="flex justify-center items-center gap-4 mt-4 text-sm font-medium text-gray-500 uppercase tracking-tighter">
                            <span>Per Tanggal: {endDate}</span>
                            <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                            <span>Mata Uang: IDR (Rupiah)</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-16">
                        {/* Left Side: Assets */}
                        <div className="space-y-4">
                            <h2 className="font-serif font-bold border-b-2 border-black pb-1 mb-4 text-sm">AKTIVA (ASET)</h2>
                            <div className="space-y-1">
                                {renderPrintRows('Asset', undefined)}
                            </div>
                            <div className="mt-8 pt-2 border-t-2 border-black flex justify-between font-serif font-bold text-sm">
                                <span>TOTAL AKTIVA</span>
                                <span>Rp {totalAset.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Right Side: Liabilities & Equity */}
                        <div className="space-y-12">
                            <div>
                                <h2 className="font-serif font-bold border-b-2 border-black pb-1 mb-4 text-sm">KEWAJIBAN (UTANG)</h2>
                                <div className="space-y-1">
                                    {renderPrintRows('Liability', undefined)}
                                </div>
                                <div className="mt-4 pt-2 border-t border-black flex justify-between font-serif font-bold text-xs italic">
                                    <span>Subtotal Kewajiban</span>
                                    <span>Rp {totalUtang.toLocaleString()}</span>
                                </div>
                            </div>

                            <div>
                                <h2 className="font-serif font-bold border-b-2 border-black pb-1 mb-4 text-sm">EKUITAS & MODAL</h2>
                                <div className="space-y-1">
                                    {renderPrintRows('Equity', undefined)}
                                    <div className="flex justify-between items-center text-[12px] py-1 text-gray-600">
                                        <span>Laba Tahun Berjalan (Net Profit)</span>
                                        <span>Rp {netProfit.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="mt-8 pt-2 border-t-2 border-black flex justify-between font-serif font-bold text-sm">
                                    <span>TOTAL PASIVA</span>
                                    <span>Rp {totalEkuitas.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Signature Area */}
                    <div className="mt-32 grid grid-cols-3 gap-8 text-center text-xs font-medium">
                        <div className="space-y-20">
                            <span>Disusun Oleh,</span>
                            <div className="border-t border-black pt-2 mx-4 text-gray-400 font-light italic">( Bagian Akuntansi )</div>
                        </div>
                        <div></div>
                        <div className="space-y-20">
                            <span>Mengetahui,</span>
                            <div className="border-t border-black pt-2 mx-4 text-gray-400 font-light italic">( Pimpinan Cabang )</div>
                        </div>
                    </div>

                    <div className="mt-20 text-[8px] text-gray-300 text-center uppercase tracking-[0.2em]">
                        Dokumen ini dihasilkan secara otomatis oleh sistem WinPOS - Keamanan Terenkripsi
                    </div>
                </div>
            </div>
        );
    };


    // --- Date Filtering State ---
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [hasAppliedDefaultToday, setHasAppliedDefaultToday] = useState(false);

    useEffect(() => {
        if (!loading && role !== null && !hasAppliedDefaultToday) {
            const lowerRole = role?.toLowerCase().trim() || '';
            const isRestricted = lowerRole === 'admin perusahaan' || permissions?.includes('limit_sales_view');
            if (isRestricted) {
                setStartDate(new Date().toISOString().split('T')[0]);
            } else {
                const date = new Date();
                date.setDate(date.getDate() - 30);
                setStartDate(date.toISOString().split('T')[0]);
            }
            setHasAppliedDefaultToday(true);
        }
    }, [loading, role, permissions, hasAppliedDefaultToday]);

    // [DIAGNOSTIC] Log current data state
    useMemo(() => {
        console.log('AccountingView State:', { 
            totalTransactions: transactions.length, 
            accountsCount: accounts.length,
            startDate,
            endDate,
            transactionsSample: transactions.slice(0, 3)
        });
    }, [transactions, accounts, startDate, endDate]);

    const fetchRealData = async () => {
        if (loading) return;
        if (!currentBranchId || !startDate || !endDate) return;
        setIsLoadingRealData(true);
        try {
            // 1. Fetch Sales with Pagination
            let allSales: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('sales')
                    .select('*')
                    .eq('branch_id', currentBranchId)
                    .gte('date', startDate + 'T00:00:00')
                    .lte('date', endDate + 'T23:59:59')
                    .order('date', { ascending: false })
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allSales = [...allSales, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else from += pageSize;
                } else {
                    hasMore = false;
                }
            }
            const hasLimit = permissions?.includes('limit_sales_view');
            const limitPercentage = Number(storeSettings?.sales_view_percentage ?? 70);
            const filteredSales = hasLimit
                ? allSales.filter(s => (s.id % 100) < limitPercentage)
                : allSales;
            setRealSales(filteredSales);

            // 2. Fetch Purchases with Pagination
            let allPurchases: any[] = [];
            let purFrom = 0;
            let purHasMore = true;

            while (purHasMore) {
                const { data: purPage, error: purError } = await supabase
                    .from('purchases')
                    .select('*')
                    .eq('branch_id', currentBranchId)
                    .gte('date', startDate + 'T00:00:00')
                    .lte('date', endDate + 'T23:59:59')
                    .range(purFrom, purFrom + pageSize - 1);
                
                if (purError) throw purError;

                if (purPage && purPage.length > 0) {
                    allPurchases = [...allPurchases, ...purPage];
                    if (purPage.length < pageSize) purHasMore = false;
                    else purFrom += pageSize;
                } else {
                    purHasMore = false;
                }
            }
            setRealPurchases(allPurchases);

        } catch (err) {
            console.error('Error fetching real data in AccountingView:', err);
        } finally {
            setIsLoadingRealData(false);
        }
    };

    useEffect(() => {
        if (hasAppliedDefaultToday) {
            fetchRealData();
        }
    }, [startDate, endDate, currentBranchId, permissions, storeSettings?.sales_view_percentage, loading, hasAppliedDefaultToday]);

    // --- Filtered Transactions for Reports ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            if (!tx.date) return false;
            const txDate = String(tx.date).split('T')[0];
            const matchesDate = txDate >= startDate && txDate <= endDate;
            
            if (!matchesDate) return false;

            if (journalSearch) {
                const search = journalSearch.toLowerCase();
                const debitName = accounts.find(a => a.code === tx.debitAccount)?.name?.toLowerCase() || '';
                const creditName = accounts.find(a => a.code === tx.creditAccount)?.name?.toLowerCase() || '';
                
                return tx.debitAccount.toLowerCase().includes(search) ||
                       tx.creditAccount.toLowerCase().includes(search) ||
                       debitName.includes(search) ||
                       creditName.includes(search) ||
                       (tx.description || '').toLowerCase().includes(search);
            }

            return true;
        });
    }, [transactions, startDate, endDate, journalSearch, accounts]);

    // --- CRUD Actions (Wrappers) ---
    const [viewingPurchase, setViewingPurchase] = useState<any>(null);

    const addAccount = (acc: Account) => onAddAccount(acc);
    const updateAccount = (updatedAcc: Account) => onUpdateAccount(updatedAcc);
    const deleteAccount = (code: string) => {
        // Prevent deletion if account is used in transactions
        const isUsed = transactions.some(t => t.debitAccount === code || t.creditAccount === code);
        if (isUsed) {
            toast.error('Gagal menghapus: Akun ini sudah digunakan dalam transaksi.');
            return;
        }
        onDeleteAccount(code);
    };

    const moveAccount = async (acc: Account, direction: 'up' | 'down') => {
        const siblings = accounts.filter(a => a.parent_code === acc.parent_code && a.type === acc.type)
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.code.localeCompare(b.code));
        
        const currentIndex = siblings.findIndex(s => s.code === acc.code);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) return;

        const targetAcc = siblings[targetIndex];
        
        // Swap order_index
        const currentOrder = acc.order_index ?? 0;
        const targetOrder = targetAcc.order_index ?? 0;

        // Ensure distinct order indices
        let newCurrentOrder = targetOrder;
        let newTargetOrder = currentOrder;
        
        if (newCurrentOrder === newTargetOrder) {
            newCurrentOrder = direction === 'up' ? targetOrder - 1 : targetOrder + 1;
        }

        await onUpdateAccount({ ...acc, order_index: newCurrentOrder });
        await onUpdateAccount({ ...targetAcc, order_index: newTargetOrder });
        
        toast.success(`Berhasil menggeser ${acc.name}`);
    };

    // --- Derived State for Reports ---
    const accountBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        accounts.forEach(acc => balances[acc.code] = 0);

        filteredTransactions.forEach(tx => {
            balances[tx.debitAccount] = (balances[tx.debitAccount] || 0) + tx.amount;
            balances[tx.creditAccount] = (balances[tx.creditAccount] || 0) - tx.amount;
        });
        return balances;
    }, [filteredTransactions, accounts]);

    const handleUpdateJournal = async (tx: JournalEntry) => {
        try {
            console.log("Updating journal:", tx);
            const { error, data } = await supabase
                .from('journal_entries')
                .update({
                    date: tx.date,
                    description: tx.description,
                    debit_account: tx.debitAccount,
                    credit_account: tx.creditAccount,
                    amount: tx.amount
                })
                .eq('id', tx.id)
                .select();

            console.log("Supabase response:", { error, data });

            if (error) throw error;
            if (!data || data.length === 0) {
                toast.error('Gagal memperbarui: ID tidak ditemukan di database.');
                return;
            }
            
            toast.success('Jurnal berhasil diperbarui');
            if (onRefresh) onRefresh();
            setIsJournalModalOpen(false);
            setEditingJournal(null);
        } catch (error: any) {
            toast.error('Gagal memperbarui jurnal: ' + error.message);
        }
    };

    // [NEW] Cumulative balances for Chart of Accounts (All-time)
    const cumulativeBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        accounts.forEach(acc => balances[acc.code] = 0);

        transactions.forEach(tx => {
            balances[tx.debitAccount] = (balances[tx.debitAccount] || 0) + tx.amount;
            balances[tx.creditAccount] = (balances[tx.creditAccount] || 0) - tx.amount;
        });
        return balances;
    }, [transactions, accounts]);

    const getBalance = (code: string, isCumulative: boolean = false) => {
        return isCumulative ? (cumulativeBalances[code] || 0) : (accountBalances[code] || 0);
    };

    const getDisplayBalance = (code: string, isCumulative: boolean = false) => {
        let raw = getBalance(code, isCumulative);
        
        // [NEW] Sinkronisasi otomatis: Gunakan posRevenueTotal jika jurnal masih 0 / lebih kecil
        if (code === '401') {
            const posRevNeg = -posRevenueTotal;
            // Ingat: Pendapatan adalah saldo normal kredit (nilainya negatif di raw)
            // Jadi jika raw > posRevNeg (misal 0 > -50000), kita gunakan posRevNeg (-50000)
            if (raw > posRevNeg) {
                raw = posRevNeg;
            }
        }

        const type = accounts.find(a => a.code === code)?.type;
        if (type === 'Asset' || type === 'Expense') return raw;
        return -raw; // Flip for Credit-normal accounts
    };

    // [NEW] Calculate Revenue directly from POS Sales for accuracy
    const posRevenueTotal = useMemo(() => {
        const PAID_STATUSES = ['paid', 'completed', 'selesai', 'settlement', 'served', 'capture', 'success', 'ready'];
        return realSales.filter(s => {
            const status = (s.status || '').toLowerCase();
            return PAID_STATUSES.includes(status);
        }).reduce((sum, s) => sum + (Number(s.total_amount || 0)), 0);
    }, [realSales]);

    const totalRevenueFromJournals = accounts.filter(a => a.type === 'Income').reduce((sum, acc) => sum + getDisplayBalance(acc.code), 0);
    
    // [STRATEGY] Use POS Revenue as the source of truth for Sale Income, but allow other Incomes (if any)
    const totalRevenue = posRevenueTotal || totalRevenueFromJournals; 
    const totalExpenses = accounts.filter(a => a.type === 'Expense').reduce((sum, acc) => sum + getDisplayBalance(acc.code), 0);
    const netProfit = totalRevenue - totalExpenses;

    // --- Renderers ---

    const exportIncomeStatementToExcel = () => {
        try {
            const incomeAccounts = accounts.filter(a => a.type === 'Income');
            const expenseAccounts = accounts.filter(a => a.type === 'Expense');

            const data = [
                { 'Kategori': 'PENDAPATAN', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': '', 'Kode': '401', 'Nama': 'Pendapatan Penjualan (POS)', 'Jumlah': posRevenueTotal },
                ...incomeAccounts.filter(a => a.code !== '401').map(a => ({ 'Kategori': '', 'Kode': a.code, 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'Total Pendapatan', 'Kode': '', 'Nama': '', 'Jumlah': totalRevenue },
                { 'Kategori': '', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'BEBAN OPERASIONAL', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                ...expenseAccounts.map(a => ({ 'Kategori': '', 'Kode': a.code, 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'Total Beban', 'Kode': '', 'Nama': '', 'Jumlah': totalExpenses },
                { 'Kategori': '', 'Kode': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'LABA BERSIH', 'Kode': '', 'Nama': '', 'Jumlah': netProfit }
            ];

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Laba Rugi");
            XLSX.writeFile(workbook, `Laba_Rugi_${startDate}_to_${endDate}.xlsx`);
            toast.success('Laporan Laba Rugi berhasil diunduh (Excel)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const exportIncomeStatementToPDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('LAPORAN LABA RUGI', 105, 20, { align: 'center' });
            doc.setFontSize(11);
            doc.text(`Periode: ${startDate} s/d ${endDate}`, 105, 28, { align: 'center' });

            const incomeData = accounts.filter(a => a.type === 'Income').map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]);
            const expenseData = accounts.filter(a => a.type === 'Expense').map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]);

            autoTable(doc, {
                startY: 40,
                head: [['Kode', 'Akun Pendapatan', 'Jumlah']],
                body: [
                    ...incomeData,
                    [{ content: 'Total Pendapatan', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalRevenue.toLocaleString()}`, styles: { fontStyle: 'bold' } }]
                ] as any,
                theme: 'striped',
                headStyles: { fillColor: [22, 163, 74] }
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Kode', 'Akun Beban', 'Jumlah']],
                body: [
                    ...expenseData,
                    [{ content: 'Total Beban', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalExpenses.toLocaleString()}`, styles: { fontStyle: 'bold' } }]
                ] as any,
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 38] }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('LABA BERSIH:', 14, finalY);
            doc.text(`Rp ${netProfit.toLocaleString()}`, 200, finalY, { align: 'right' });

            doc.save(`Laba_Rugi_${startDate}_to_${endDate}.pdf`);
            toast.success('Laporan Laba Rugi berhasil diunduh (PDF)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const exportFinancialPositionToExcel = () => {
        try {
            const data: any[] = [];
            
            const addRows = (parentCode: string | undefined, level: number = 0) => {
                const children = accounts.filter(a => a.parent_code === parentCode).sort((a, b) => a.code.localeCompare(b.code));
                children.forEach(acc => {
                    const balance = getDisplayBalance(acc.code);
                    const hasChildren = accounts.some(a => a.parent_code === acc.code);
                    
                    data.push({
                        'Kode': acc.code,
                        'Nama Akun': (level > 0 ? '  '.repeat(level) + '└ ' : '') + acc.name,
                        'Tipe': acc.type,
                        'Saldo': balance
                    });
                    
                    if (hasChildren) {
                        addRows(acc.code, level + 1);
                    }
                });
            };

            data.push({ 'Kode': '---', 'Nama Akun': 'AKTIVA (ASET)', 'Tipe': '', 'Saldo': '' });
            const assetAccounts = accounts.filter(a => a.type === 'Asset' && !a.parent_code);
            assetAccounts.forEach(a => addRows(a.parent_code === undefined ? undefined : a.code, 0)); // Start from top assets
            // Fix: The above logic was a bit circular, let's simplify:
            const topAssets = accounts.filter(a => a.type === 'Asset' && !a.parent_code).sort((a,b) => a.code.localeCompare(b.code));
            
            const finalData: any[] = [];
            const processHierarchy = (accList: Account[], typeLabel: string) => {
                finalData.push({ 'Kode': '', 'Nama Akun': typeLabel, 'Tipe': '', 'Saldo': '' });
                
                const recurse = (pCode: string | undefined, level: number) => {
                    const children = accounts.filter(a => {
                        const isMatch = pCode ? a.parent_code === pCode : (!a.parent_code || a.parent_code === '');
                        return isMatch && (pCode ? true : accList.some(al => al.code === a.code));
                    }).sort((a,b) => a.code.localeCompare(b.code));
                    children.forEach(acc => {
                        const isLabel = acc.type === 'Label';
                        finalData.push({
                            'Kode': isLabel ? '' : acc.code,
                            'Nama Akun': (level > 0 ? '  '.repeat(level) + ' ' : '') + acc.name,
                            'Tipe': acc.type,
                            'Saldo': isLabel ? '' : getDisplayBalance(acc.code)
                        });
                        recurse(acc.code, level + 1);
                    });
                };

                accList.forEach(a => {
                    const isLabel = a.type === 'Label';
                    finalData.push({
                        'Kode': isLabel ? '' : a.code,
                        'Nama Akun': a.name,
                        'Tipe': a.type,
                        'Saldo': isLabel ? '' : getDisplayBalance(a.code)
                    });
                    recurse(a.code, 1);
                });
            };

            processHierarchy(accounts.filter(a => a.type === 'Asset' && !a.parent_code), '--- AKTIVA (ASET) ---');
            processHierarchy(accounts.filter(a => a.type === 'Liability' && !a.parent_code), '--- KEWAJIBAN (UTANG) ---');
            processHierarchy(accounts.filter(a => a.type === 'Equity' && !a.parent_code), '--- EKUITAS & MODAL ---');
            finalData.push({ 'Kode': '', 'Nama Akun': 'Laba Tahun Berjalan', 'Tipe': 'Equity', 'Saldo': netProfit });

            const worksheet = XLSX.utils.json_to_sheet(finalData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Posisi Keuangan");
            XLSX.writeFile(workbook, `Posisi_Keuangan_${startDate}_to_${endDate}.xlsx`);
            toast.success('Laporan Posisi Keuangan berhasil diunduh (Excel)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const exportFinancialPositionToPDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text('LAPORAN POSISI KEUANGAN', 105, 20, { align: 'center' });
            doc.setFontSize(11);
            doc.text(`Periode: Per ${endDate}`, 105, 28, { align: 'center' });

            const body: any[] = [];
            
            const buildBodyRows = (accList: Account[], typeLabel: string) => {
                body.push([{ content: typeLabel, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
                
                const recurse = (pCode: string | undefined, level: number) => {
                    const children = accounts.filter(a => {
                        const isMatch = pCode ? a.parent_code === pCode : (!a.parent_code || a.parent_code === '');
                        return isMatch && (pCode ? true : accList.some(al => al.code === a.code));
                    }).sort((a,b) => a.code.localeCompare(b.code));
                    children.forEach(acc => {
                        const isLabel = acc.type === 'Label';
                        body.push([
                            isLabel ? '' : acc.code, 
                            (level > 0 ? '      '.repeat(level) : '') + acc.name, 
                            isLabel ? '' : `Rp ${getDisplayBalance(acc.code).toLocaleString()}`
                        ]);
                        recurse(acc.code, level + 1);
                    });
                };

                accList.forEach(a => {
                    const isLabel = a.type === 'Label';
                    body.push([
                        { content: isLabel ? '' : a.code, styles: { fontStyle: 'bold' } }, 
                        { content: a.name, styles: { fontStyle: 'bold' } }, 
                        { content: isLabel ? '' : `Rp ${getDisplayBalance(a.code).toLocaleString()}`, styles: { fontStyle: 'bold' } }
                    ]);
                    recurse(a.code, 1);
                });
            };

            buildBodyRows(accounts.filter(a => a.type === 'Asset' && !a.parent_code), 'AKTIVA (ASET)');
            body.push([{ content: 'TOTAL ASET', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }, { content: `Rp ${accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + getDisplayBalance(a.code), 0).toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }]);

            buildBodyRows(accounts.filter(a => a.type === 'Liability' && !a.parent_code), 'KEWAJIBAN (UTANG)');
            buildBodyRows(accounts.filter(a => a.type === 'Equity' && !a.parent_code), 'EKUITAS & MODAL');
            body.push(['-', 'Laba Tahun Berjalan', `Rp ${netProfit.toLocaleString()}`]);
            
            const totalPasiva = accounts.filter(a => a.type === 'Liability' || a.type === 'Equity').reduce((s, a) => s + getDisplayBalance(a.code), 0) + netProfit;
            body.push([{ content: 'TOTAL PASIVA (UTANG & MODAL)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }, { content: `Rp ${totalPasiva.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }]);

            autoTable(doc, {
                startY: 40,
                head: [['Kode', 'Uraian', 'Jumlah']],
                body: body as any,
                theme: 'plain',
                styles: { fontSize: 9 },
                columnStyles: { 2: { halign: 'right' } }
            });

            doc.save(`Posisi_Keuangan_${startDate}_to_${endDate}.pdf`);
            toast.success('Laporan Posisi Keuangan berhasil diunduh (PDF)');
        } catch (error) {
            toast.error('Gagal mengekspor laporan');
        }
    };

    const renderAccountModal = () => {
        if (!isAccountModalOpen) return null;

        const handleSave = async (e: React.FormEvent) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const formData = new FormData(form);
            const accountData: Account = {
                code: formData.get('code') as string,
                name: formData.get('name') as string,
                type: formData.get('type') as AccountType,
                parent_code: formData.get('parent_code') as string || undefined,
                description: formData.get('description') as string || undefined
            };

            if (editingAccount) {
                await updateAccount(accountData);
            } else {
                await addAccount(accountData);
            }
            setIsAccountModalOpen(false);
            setEditingAccount(null);
        };

        const initialData = editingAccount || { 
            code: initialTypeForNewAccount === 'Label' ? (window as any).__lastSectionPrefix + '-TXT-' + Date.now().toString().slice(-6) : '', 
            name: '', 
            type: initialTypeForNewAccount, 
            parent_code: '', 
            description: '' 
        };

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className={`p-6 text-white flex justify-between items-center ${initialData.type === 'Label' ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-gradient-to-r from-blue-600 to-indigo-700'}`}>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            {editingAccount ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {editingAccount ? 'Edit Akun' : (initialData.type === 'Label' ? 'Tambah Baris Teks / Label' : 'Tambah Akun Baru')}
                            <span className="text-[8px] opacity-50 font-mono">({initialData.type})</span>
                        </h3>
                        <button onClick={() => { setIsAccountModalOpen(false); setEditingAccount(null); }} className="hover:rotate-90 transition-transform">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={handleSave} className="p-8 space-y-5">
                        <div className={`space-y-2 ${initialData.type === 'Label' ? 'hidden' : ''}`}>
                            <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Kode Akun</label>
                            <input
                                name="code"
                                defaultValue={initialData.code || (initialData.type === 'Label' ? 'TXT-' + Date.now().toString().slice(-6) : '')}
                                readOnly={!!editingAccount}
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none font-mono"
                                placeholder="Contoh: 1101"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-wider">
                                {initialData.type === 'Label' ? 'Isi Tulisan / Teks' : 'Nama Akun'}
                            </label>
                            <input
                                name="name"
                                defaultValue={initialData.name}
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                placeholder={initialData.type === 'Label' ? 'Contoh: ASET LANCAR' : 'Contoh: Kas Kecil'}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`space-y-2 ${initialData.type === 'Label' ? 'hidden' : ''}`}>
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Tipe Akun</label>
                                <select
                                    name="type"
                                    defaultValue={initialData.type}
                                    key={initialData.type} // Force re-render select when default value changes
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none"
                                >
                                    <option value="Asset">Asset (Harta)</option>
                                    <option value="Liability">Liability (Utang)</option>
                                    <option value="Equity">Equity (Modal)</option>
                                    <option value="Income">Income (Pendapatan)</option>
                                    <option value="Expense">Expense (Beban)</option>
                                    <option value="Label">Label / Sub-Judul (Tanpa Saldo)</option>
                                </select>
                            </div>
                            <div className={`space-y-2 ${initialData.type === 'Label' ? 'col-span-2' : ''}`}>
                                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">
                                    {initialData.type === 'Label' ? 'Letakkan di Bawah...' : 'Induk Akun'}
                                </label>
                                <select
                                    name="parent_code"
                                    defaultValue={initialData.parent_code}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none"
                                >
                                    <option value="">- Tanpa Induk (Paling Atas) -</option>
                                    {accounts.filter(a => a.code !== editingAccount?.code).map(a => (
                                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Keterangan (Opsional)</label>
                            <textarea
                                name="description"
                                defaultValue={initialData.description}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none"
                                placeholder="Tambahkan catatan atau keterangan akun di sini..."
                                rows={2}
                            />
                        </div>
                        <div className="pt-4 flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 rounded-xl py-6"
                                onClick={() => { setIsAccountModalOpen(false); setEditingAccount(null); }}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl py-6 shadow-lg shadow-blue-200"
                            >
                                {editingAccount ? 'Simpan Perubahan' : (initialData.type === 'Label' ? 'Simpan Teks' : 'Tambah Akun')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const renderFinancialPosition = () => {
        const renderAccountRows = (type: AccountType | undefined, parentCode: string | undefined, level: number = 0): { rows: React.ReactNode[], subTotal: number } => {
            let total = 0;
            const children = accounts.filter(a => {
                const isMatch = parentCode 
                    ? a.parent_code === parentCode 
                    : (!a.parent_code || a.parent_code === '');
                
                if (!isMatch) return false;
                if (parentCode) return true;

                // Root level filtering: Label accounts use their code prefix (1, 2, 3)
                if (a.type === 'Label') {
                    if (type === 'Asset' && a.code.startsWith('1')) return true;
                    if (type === 'Liability' && a.code.startsWith('2')) return true;
                    if (type === 'Equity' && a.code.startsWith('3')) return true;
                    return false;
                }
                
                return type ? a.type === type : true;
            }).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.code.localeCompare(b.code));
            
            const rows = children.flatMap(acc => {
                const balance = getDisplayBalance(acc.code);
                const subHierarchy = renderAccountRows(undefined, acc.code, level + 1);
                const currentTotal = balance + subHierarchy.subTotal;
                total += currentTotal;

                const hasChildren = accounts.some(a => a.parent_code === acc.code);
                const isLabel = acc.type === 'Label';

                return [
                    <div key={acc.code} className={`${(hasChildren || isLabel) ? 'mt-4 mb-2' : ''} group`}>
                        <div 
                            className={`flex justify-between items-center py-2 px-3 rounded-lg transition-all cursor-pointer ${
                                isLabel
                                    ? 'bg-gray-100/50 font-black text-gray-800 border-l-4 border-gray-400 hover:bg-gray-200/50'
                                    : hasChildren 
                                        ? 'bg-blue-50/50 font-black text-blue-900 border-l-4 border-blue-600 hover:bg-blue-100/50' 
                                        : 'text-sm text-gray-600 hover:bg-blue-50 border-b border-dashed border-gray-100'
                            }`} 
                            onClick={() => {
                                if (!isLabel) {
                                    setSelectedLedgerAccount(acc.code);
                                    setActiveTab('ledger');
                                }
                            }}
                            title={isLabel ? '' : `Klik untuk melihat rincian Buku Besar ${acc.name}`}
                            style={{ marginLeft: `${level * 1}rem` }}
                        >
                            <span className="flex flex-col">
                                <span className="flex items-center gap-2">
                                    {level > 0 && <span className="text-gray-300 font-light">└─</span>}
                                    {isLabel ? acc.name : `${acc.code} - ${acc.name}`}
                                    
                                    {/* Row Actions */}
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveAccount(acc, 'up');
                                            }}
                                            className="p-1 hover:bg-gray-100 text-gray-400 rounded transition-colors"
                                            title="Geser Atas"
                                        >
                                            <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveAccount(acc, 'down');
                                            }}
                                            className="p-1 hover:bg-gray-100 text-gray-400 rounded transition-colors"
                                            title="Geser Bawah"
                                        >
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                        {!isLabel && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingAccount(acc);
                                                    setIsAccountModalOpen(true);
                                                }}
                                                className="p-1 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                                                title="Edit Akun"
                                            >
                                                <Edit className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Hapus akun ${acc.name}?`)) {
                                                    deleteAccount(acc.code);
                                                }
                                            }}
                                            className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                                            title="Hapus Akun"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </span>
                                {acc.description && (
                                    <span className={`text-[10px] text-gray-400 italic font-light ${level > 0 ? 'ml-6' : 'ml-0'}`}>
                                        {acc.description}
                                    </span>
                                )}
                            </span>
                            {!isLabel && (
                                <span className={hasChildren ? 'text-blue-700' : 'font-mono'}>
                                    Rp {currentTotal.toLocaleString()}
                                </span>
                            )}
                        </div>
                        {subHierarchy.rows}
                    </div>
                ];
            });

            return { rows, subTotal: total };
        };

        const assetSections = renderAccountRows('Asset', undefined).rows;
        const liabilitySections = renderAccountRows('Liability', undefined).rows;
        const equitySections = renderAccountRows('Equity', undefined).rows;

        const totalAset = accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalUtang = accounts.filter(a => a.type === 'Liability').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalEkuitasWithoutProfit = accounts.filter(a => a.type === 'Equity').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalEkuitas = totalEkuitasWithoutProfit + netProfit;



        return (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">
                            Laporan Posisi Keuangan <span className="text-[10px] text-gray-300 font-normal">V.2.1</span>
                        </h2>
                        <p className="text-gray-500">WinPOS Enterprise • Per {endDate}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => setIsPreviewOpen(true)}
                        >
                            <Eye className="w-4 h-4" /> Preview Cetak
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={exportFinancialPositionToExcel}
                        >
                            <Download className="w-4 h-4" /> Excel
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={exportFinancialPositionToPDF}
                        >
                            <FileText className="w-4 h-4" /> PDF
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* SISI AKTIVA (ASET) */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-end border-b-2 border-blue-700 pb-1">
                            <h3 className="font-black text-lg text-blue-700 uppercase">Aktiva (Aset)</h3>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => {
                                        (window as any).__lastSectionPrefix = '1';
                                        setInitialTypeForNewAccount('Label');
                                        setEditingAccount(null);
                                        setIsAccountModalOpen(true);
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors uppercase tracking-tighter"
                                >
                                    <Plus className="w-2.5 h-2.5" /> Teks
                                </button>
                                <button 
                                    onClick={() => {
                                        setInitialTypeForNewAccount('Asset');
                                        setEditingAccount(null);
                                        setIsAccountModalOpen(true);
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors uppercase tracking-tighter"
                                >
                                    <Plus className="w-2.5 h-2.5" /> Akun
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {assetSections}
                        </div>
                        <div className="flex justify-between font-black text-xl text-white bg-blue-600 p-4 rounded-xl shadow-sm">
                            <span>TOTAL ASET</span>
                            <span>Rp {totalAset.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* SISI PASIVA (KEWAJIBAN & EKUITAS) */}
                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between items-end border-b-2 border-red-700 pb-1">
                                <h3 className="font-black text-lg text-red-700 uppercase">Kewajiban (Utang)</h3>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => {
                                            (window as any).__lastSectionPrefix = '2';
                                            setInitialTypeForNewAccount('Label');
                                            setEditingAccount(null);
                                            setIsAccountModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors uppercase tracking-tighter"
                                    >
                                        <Plus className="w-2.5 h-2.5" /> Teks
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setInitialTypeForNewAccount('Liability');
                                            setEditingAccount(null);
                                            setIsAccountModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 px-2 py-1 rounded-full hover:bg-red-100 transition-colors uppercase tracking-tighter"
                                    >
                                        <Plus className="w-2.5 h-2.5" /> Akun
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 space-y-4">
                                {liabilitySections}
                            </div>
                            <div className="flex justify-between font-bold text-gray-900 mt-4 p-3 bg-gray-50 rounded-lg border">
                                <span>TOTAL UTANG</span>
                                <span>Rp {totalUtang.toLocaleString()}</span>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end border-b-2 border-emerald-700 pb-1">
                                <h3 className="font-black text-lg text-emerald-700 uppercase">Ekuitas & Modal</h3>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => {
                                            (window as any).__lastSectionPrefix = '3';
                                            setInitialTypeForNewAccount('Label');
                                            setEditingAccount(null);
                                            setIsAccountModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors uppercase tracking-tighter"
                                    >
                                        <Plus className="w-2.5 h-2.5" /> Teks
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setInitialTypeForNewAccount('Equity');
                                            setEditingAccount(null);
                                            setIsAccountModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full hover:bg-emerald-100 transition-colors uppercase tracking-tighter"
                                    >
                                        <Plus className="w-2.5 h-2.5" /> Akun
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 space-y-4">
                                {equitySections}
                                <div className="flex justify-between text-sm py-1 border-b border-dashed border-gray-100 text-blue-600 font-medium">
                                    <span>Laba Tahun Berjalan (Net Profit)</span>
                                    <span>Rp {netProfit.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex justify-between font-bold text-gray-900 mt-4 p-3 bg-gray-50 rounded-lg border">
                                <span>TOTAL EKUITAS</span>
                                <span>Rp {totalEkuitas.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex justify-between font-black text-xl text-white bg-gray-800 p-4 rounded-xl shadow-sm">
                            <span>TOTAL PASIVA</span>
                            <span>Rp {(totalUtang + totalEkuitas).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 rounded-xl"><TrendingUp className="w-6 h-6 text-green-600" /></div>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
                    </div>
                    <p className="text-gray-500 text-sm">Total Pendapatan</p>
                    <h3 className="text-2xl font-bold text-gray-800">Rp {totalRevenue.toLocaleString()}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-50 rounded-xl"><TrendingDown className="w-6 h-6 text-red-600" /></div>
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">+5%</span>
                    </div>
                    <p className="text-gray-500 text-sm">Total Beban</p>
                    <h3 className="text-2xl font-bold text-gray-800">Rp {totalExpenses.toLocaleString()}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 rounded-xl"><Wallet className="w-6 h-6 text-blue-600" /></div>
                    </div>
                    <p className="text-gray-500 text-sm">Laba Bersih</p>
                    <h3 className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        Rp {netProfit.toLocaleString()}
                    </h3>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6">
                <h3 className="font-bold text-gray-800 mb-4">Transaksi Terakhir</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th className="pb-3">Tanggal</th>
                            <th className="pb-3">Keterangan</th>
                            <th className="pb-3 text-right">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransactions.slice().reverse().slice(0, 5).map(tx => (
                            <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-3 text-gray-600">{tx.date}</td>
                                <td className="py-3 font-medium text-gray-800">{tx.description}</td>
                                <td className="py-3 text-right font-bold">Rp {tx.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderReports = (type: 'income' | 'balance') => {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">
                            {type === 'income' ? 'Laporan Laba Rugi' : 'Laporan Neraca'}
                        </h2>
                        <p className="text-gray-500">WinPOS Enterprise • {startDate} s/d {endDate}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 group"
                            onClick={() => {
                                if(confirm('Sinkronkan & Bersihkan catatan hantu? (Menghapus jurnal dari transaksi yang sudah tidak ada)')) {
                                    onRefresh?.(); 
                                    toast.success('Pembersihan selesai');
                                }
                            }}
                        >
                            <CalendarCheck className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Bersihkan Jurnal
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={type === 'income' ? exportIncomeStatementToExcel : exportFinancialPositionToExcel}
                        >
                            <Download className="w-4 h-4" /> Excel
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={type === 'income' ? exportIncomeStatementToPDF : exportFinancialPositionToPDF}
                        >
                            <FileText className="w-4 h-4" /> PDF
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    {type === 'income' ? (
                        <>
                            <div>
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 flex justify-between items-center">
                                    Pendapatan
                                    <span className="text-[10px] font-normal text-blue-500 uppercase tracking-widest">(POS Synchronized)</span>
                                </h3>
                                
                                {/* [NEW] POS Sales Injection */}
                                <div className="flex justify-between py-1 px-4 bg-blue-50/50 rounded mb-1 text-blue-700 font-medium">
                                    <span>401 - Pendapatan Penjualan (POS)</span>
                                    <span>Rp {posRevenueTotal.toLocaleString()}</span>
                                </div>

                                {accounts.filter(a => a.type === 'Income' && a.code !== '401').map(acc => (
                                    <div key={acc.code} className="flex justify-between py-1 px-4 hover:bg-gray-50 border-b border-dashed border-gray-100 last:border-0 text-gray-600">
                                        <span>{acc.code} - {acc.name}</span>
                                        <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold text-green-700 mt-2 bg-green-50 p-2 rounded border border-green-100">
                                    <span>Total Pendapatan</span>
                                    <span>Rp {totalRevenue.toLocaleString()}</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Beban Operasional</h3>
                                {accounts.filter(a => a.type === 'Expense').map(acc => (
                                    <div key={acc.code} className="flex justify-between py-1 px-4 hover:bg-gray-50">
                                        <span>{acc.code} - {acc.name}</span>
                                        <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold text-red-700 mt-2 bg-red-50 p-2 rounded">
                                    <span>Total Beban</span>
                                    <span>(Rp {totalExpenses.toLocaleString()})</span>
                                </div>
                            </div>
                            <div className="flex justify-between text-xl font-bold border-t-2 border-gray-800 pt-4 mt-8">
                                <span>Laba Bersih</span>
                                <span className={netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}>Rp {netProfit.toLocaleString()}</span>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 uppercase text-sm">Aktiva (Assets)</h3>
                                {accounts.filter(a => a.type === 'Asset').map(acc => (
                                    <div key={acc.code} className="flex justify-between py-1 text-sm">
                                        <span>{acc.name}</span>
                                        <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between font-bold mt-4 pt-2 border-t">
                                    <span>Total Aktiva</span>
                                    <span>Rp {accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + getDisplayBalance(a.code), 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <div>
                                <div className="mb-6">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 uppercase text-sm">Kewajiban (Liabilities)</h3>
                                    {accounts.filter(a => a.type === 'Liability').map(acc => (
                                        <div key={acc.code} className="flex justify-between py-1 text-sm">
                                            <span>{acc.name}</span>
                                            <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 uppercase text-sm">Ekuitas & Modal</h3>
                                    {accounts.filter(a => a.type === 'Equity').map(acc => (
                                        <div key={acc.code} className="flex justify-between py-1 text-sm">
                                            <span>{acc.name}</span>
                                            <span>Rp {getDisplayBalance(acc.code).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-1 text-sm font-medium text-blue-600">
                                        <span>Laba Tahun Berjalan</span>
                                        <span>Rp {netProfit.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between font-bold mt-4 pt-2 border-t">
                                    <span>Total Pasiva</span>
                                    <span>Rp {(
                                        accounts.filter(a => a.type === 'Liability' || a.type === 'Equity').reduce((s, a) => s + getDisplayBalance(a.code), 0) + netProfit
                                    ).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }


    const tabs = [
        { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
        { id: 'income', label: 'Laba Rugi', icon: TrendingUp },
        { id: 'balance', label: 'Neraca', icon: FileText },
        { id: 'hpp', label: 'Laporan HPP', icon: TrendingDown },
        { id: 'journal', label: 'Jurnal Umum', icon: Plus },
        { id: 'ledger', label: 'Buku Besar', icon: BookOpen },
        { id: 'pettycash', label: 'Kas Kecil', icon: Wallet },
        { id: 'purchase_history', label: 'Riwayat Pembelian', icon: ShoppingCart },
        { id: 'accounts', label: 'Daftar Akun', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {renderAccountModal()}
            {renderPrintPreview()}
            
            {/* [NEW] Journal Entry / Edit Modal */}
            {isJournalModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-blue-600"></div>
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-gray-800">{editingJournal ? 'Edit Transaksi' : 'Input Jurnal Baru'}</h3>
                                <p className="text-sm text-gray-400 font-medium">Lengkapi rincian mutasi akun di bawah ini.</p>
                            </div>
                            <button 
                                onClick={() => { setIsJournalModalOpen(false); setEditingJournal(null); }} 
                                className="text-gray-400 hover:text-gray-600 p-2 bg-gray-100 rounded-full transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form 
                            className="space-y-6"
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const formData = new FormData(form);
                                
                                const tx: JournalEntry = {
                                    id: editingJournal ? editingJournal.id : Date.now(),
                                    date: formData.get('date') as string,
                                    description: formData.get('description') as string,
                                    debitAccount: formData.get('debitAccount') as string,
                                    creditAccount: formData.get('creditAccount') as string,
                                    amount: parseInt(formData.get('amount') as string)
                                };

                                if (!tx.date || !tx.debitAccount || !tx.creditAccount || !tx.amount) {
                                    toast.error('Mohon lengkapi semua field wajib!');
                                    return;
                                }

                                if (editingJournal) {
                                    await handleUpdateJournal(tx);
                                } else {
                                    await onAddTransaction(tx);
                                    toast.success('Jurnal baru berhasil disimpan');
                                    setIsJournalModalOpen(false);
                                }
                            }}
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Tanggal</label>
                                    <input 
                                        type="date" 
                                        name="date"
                                        required
                                        defaultValue={editingJournal?.date || new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Nominal (Rp)</label>
                                    <input 
                                        type="number" 
                                        name="amount"
                                        required
                                        placeholder="0"
                                        defaultValue={editingJournal?.amount}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-primary" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                 <div className="space-y-2">
                                     <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Keterangan</label>
                                     <input 
                                         type="text" 
                                         name="description"
                                         id="journal_desc"
                                         required
                                         placeholder="Contoh: Pembelian Bahan Spanduk - via Tunai"
                                         defaultValue={editingJournal?.description}
                                         className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
                                     />
                                 </div>

                                 {/* Display Linked Purchase Info if available */}
                                 {linkedPurchase && (
                                     <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl space-y-1">
                                         <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Informasi Transaksi Asli (Pembelian)</div>
                                         <div className="flex justify-between items-center text-xs">
                                             <span className="text-gray-500">Supplier:</span>
                                             <span className="font-bold text-gray-800">{linkedPurchase.supplier_name}</span>
                                         </div>
                                         <div className="flex justify-between items-center text-xs">
                                             <span className="text-gray-500">Metode Bayar Asli:</span>
                                             <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded font-black">{linkedPurchase.payment_method?.toUpperCase()}</span>
                                         </div>
                                     </div>
                                 )}
                             </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-green-600 tracking-wider">Akun Debit (Masuk)</label>
                                    <select 
                                        name="debitAccount"
                                        required
                                        defaultValue={editingJournal?.debitAccount || selectedLedgerAccount || ''}
                                        className="w-full px-4 py-3 bg-green-50/30 border border-green-100 rounded-xl focus:ring-2 focus:ring-green-500/20 outline-none appearance-none"
                                    >
                                        <option value="">Pilih Akun...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-red-600 tracking-wider">Akun Kredit (Keluar)</label>
                                    <select 
                                        name="creditAccount"
                                        id="credit_acc_select"
                                        required
                                        defaultValue={editingJournal?.creditAccount || ''}
                                        className="w-full px-4 py-3 bg-red-50/30 border border-red-100 rounded-xl focus:ring-2 focus:ring-red-500/20 outline-none appearance-none"
                                    >
                                        <option value="">Pilih Akun...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="flex-1 rounded-xl py-6"
                                    onClick={() => { setIsJournalModalOpen(false); setEditingJournal(null); }}
                                >
                                    Batal
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="flex-1 bg-primary hover:bg-primary/90 rounded-xl py-6 shadow-lg shadow-primary/20"
                                >
                                    {editingJournal ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-center px-4 md:px-8 py-6 bg-white border-b">
                <div>
                    <h2 className="text-2xl font-black text-gray-800">Modul Akuntansi</h2>
                    <p className="text-sm text-gray-500">Pencatatan keuangan standar akuntansi Indonesia.</p>
                </div>
                {onBack && (
                    <Button
                        onClick={onBack}
                        variant="outline"
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl"
                    >
                        <LayoutDashboard className="w-4 h-4 rotate-180 text-gray-500" />
                        Kembali ke Dashboard
                    </Button>
                )}
            </div>

            {/* Navigation Tabs & Date Filters */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 md:p-8 bg-white border-b sticky top-0 z-30 shadow-sm">
                <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-xl max-w-full">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id
                                ? 'bg-white text-primary shadow-md scale-105'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <DateRangePicker 
                        startDate={startDate}
                        endDate={endDate}
                        onChange={(range) => {
                            setStartDate(range.startDate);
                            setEndDate(range.endDate);
                        }}
                    />
                    <Button
                        onClick={() => {
                            if (onRefresh) onRefresh();
                            toast.info('Memperbarui data akuntansi...');
                        }}
                        variant="outline"
                        className="flex items-center gap-2 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 rounded-xl px-4"
                    >
                        <RefreshCw className="w-4 h-4" /> 
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'journal' && (
                    <JournalTab
                        transactions={filteredTransactions}
                        accounts={accounts}
                        onAddTransaction={(tx) => onAddTransaction(tx)}
                        onDeleteTransaction={(id) => onDeleteTransaction(id)}
                        onResetTransactions={() => onResetTransactions()}
                        role={role || ''}
                        searchQuery={journalSearch}
                        onSearchChange={setJournalSearch}
                    />
                )}
                {activeTab === 'pettycash' && (
                    <PettyCashTab 
                        branchId={currentBranchId || sales[0]?.branch_id || ''} 
                        userId={user?.id} 
                        purchases={purchases} 
                        startDate={startDate}
                        endDate={endDate}
                        onAddTransaction={onAddTransaction}
                        accounts={accounts}
                    />
                )}
                {activeTab === 'purchase_history' && (
                    <PurchaseHistoryTab 
                        purchases={realPurchases.length > 0 ? realPurchases : purchases} 
                        onCRUD={onPurchaseCRUD} 
                    />
                )}

                {activeTab === 'ledger' && (
                    <div className="flex flex-col lg:flex-row gap-6 h-[700px] animate-in fade-in slide-in-from-bottom-4">
                        {/* Sidebar: Account List */}
                        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 text-sm mb-3">Pilih Akun</h3>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <input 
                                        type="text"
                                        placeholder="Cari kode atau nama..."
                                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        onChange={(e) => setJournalSearch(e.target.value)}
                                        value={journalSearch}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {accounts.filter(a => 
                                    a.code.toLowerCase().includes(journalSearch.toLowerCase()) || 
                                    a.name.toLowerCase().includes(journalSearch.toLowerCase())
                                ).map(acc => {
                                    const isSelected = selectedLedgerAccount === acc.code;
                                    const bal = getDisplayBalance(acc.code);
                                    return (
                                        <button 
                                            key={acc.code}
                                            onClick={() => setSelectedLedgerAccount(acc.code)}
                                            className={`w-full text-left p-3 rounded-xl transition-all group ${
                                                isSelected 
                                                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                                                    : 'hover:bg-gray-50 text-gray-700'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                                    {acc.code}
                                                </span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                    isSelected ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {acc.type}
                                                </span>
                                            </div>
                                            <div className="font-bold text-xs truncate mb-1">{acc.name}</div>
                                            <div className={`text-[11px] font-mono font-bold text-right ${isSelected ? 'text-white' : 'text-primary'}`}>
                                                Rp {bal.toLocaleString()}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Main Content: Ledger Detail */}
                        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                            {!selectedLedgerAccount ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                        <BookOpen className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <h3 className="font-bold text-gray-800 mb-1">Buku Besar</h3>
                                    <p className="text-sm text-center max-w-xs">Pilih salah satu akun di samping untuk melihat rincian mutasi dan saldo berjalan.</p>
                                </div>
                            ) : (() => {
                                const acc = accounts.find(a => a.code === selectedLedgerAccount);
                                if (!acc) return null;

                                // 1. Saldo Awal (Transactions before startDate)
                                const saldoAwalRaw = transactions.filter(tx => 
                                    String(tx.date).split('T')[0] < startDate && 
                                    (tx.debitAccount === acc.code || tx.creditAccount === acc.code)
                                ).reduce((sum, tx) => {
                                    if (tx.debitAccount === acc.code) return sum + tx.amount;
                                    return sum - tx.amount;
                                }, 0);

                                const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';
                                const saldoAwal = isDebitNormal ? saldoAwalRaw : -saldoAwalRaw;

                                // 2. Current Transactions (Mutasi)
                                const mutasi = transactions.filter(tx => {
                                    const d = String(tx.date).split('T')[0];
                                    return d >= startDate && d <= endDate && (tx.debitAccount === acc.code || tx.creditAccount === acc.code);
                                }).sort((a, b) => a.date.localeCompare(b.date));

                                // 3. Build Ledger Rows with Running Balance
                                let runningRaw = saldoAwalRaw;
                                const rows = mutasi.map(tx => {
                                    const isDebit = tx.debitAccount === acc.code;
                                    if (isDebit) runningRaw += tx.amount;
                                    else runningRaw -= tx.amount;

                                    return {
                                        ...tx,
                                        debit: isDebit ? tx.amount : 0,
                                        credit: !isDebit ? tx.amount : 0,
                                        balance: isDebitNormal ? runningRaw : -runningRaw
                                    };
                                });

                                const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
                                const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
                                const saldoAkhir = isDebitNormal ? runningRaw : -runningRaw;

                                return (
                                    <>
                                        <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded uppercase tracking-widest">{acc.code}</span>
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{acc.type}</span>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingAccount(acc);
                                                            setIsAccountModalOpen(true);
                                                        }}
                                                        className="p-1 hover:bg-primary/10 text-primary rounded transition-all"
                                                        title="Edit Nama/Detail Akun"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <h2 className="text-xl font-black text-gray-800">{acc.name}</h2>
                                            </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Saldo Berjalan</p>
                                                        <p className="text-2xl font-black text-primary font-mono">Rp {saldoAkhir.toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button 
                                                            size="sm"
                                                            className="bg-green-600 text-white hover:bg-green-700 border-none font-bold flex items-center gap-2 rounded-xl"
                                                            onClick={() => {
                                                                setEditingJournal(null);
                                                                setIsJournalModalOpen(true);
                                                            }}
                                                        >
                                                            <Plus className="w-4 h-4" /> TAMBAH TRANSAKSI
                                                        </Button>
                                                        <Button 
                                                            size="sm"
                                                            variant="outline"
                                                            className="bg-blue-600 text-white hover:bg-blue-700 border-none font-bold rounded-xl"
                                                            onClick={() => {
                                                                setStartDate('2024-01-01');
                                                                setEndDate(new Date().toISOString().split('T')[0]);
                                                                toast.info('Menampilkan seluruh riwayat transaksi...');
                                                            }}
                                                        >
                                                            LIHAT SEMUA RIWAYAT
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                        <div className="flex-1 overflow-y-auto">
                                            <table className="w-full text-xs border-collapse">
                                                <thead className="bg-gray-50/50 sticky top-0 z-10">
                                                    <tr className="text-gray-500 font-bold border-b">
                                                        <th className="px-6 py-4 text-left">Tanggal</th>
                                                        <th className="px-6 py-4 text-left">Keterangan</th>
                                                        <th className="px-6 py-4 text-right">Debit</th>
                                                        <th className="px-6 py-4 text-right">Kredit</th>
                                                        <th className="px-6 py-4 text-right bg-gray-100/30">Saldo</th>
                                                        <th className="px-6 py-4 text-center">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {/* Row Saldo Awal */}
                                                    <tr className="bg-blue-50/20 italic">
                                                        <td className="px-6 py-4 text-gray-400">{startDate}</td>
                                                        <td className="px-6 py-4 font-bold text-gray-600">Saldo Awal (Awal Periode)</td>
                                                        <td className="px-6 py-4 text-right">-</td>
                                                        <td className="px-6 py-4 text-right">-</td>
                                                        <td className="px-6 py-4 text-right font-black bg-blue-50/30 text-blue-700">Rp {saldoAwal.toLocaleString()}</td>
                                                        <td className="px-6 py-4"></td>
                                                    </tr>

                                                    {rows.map((row, idx) => {
                                                        const isPurchase = row.description.includes('Pembelian Bahan:');
                                                        // Find the original transaction ID for CRUD
                                                        const originalTx = transactions.find(t => t.id === row.id);

                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors group">
                                                                <td className="px-6 py-4 text-gray-500">{row.date}</td>
                                                                <td className="px-6 py-4 font-medium text-gray-800">
                                                                    <div className="flex items-center gap-2">
                                                                        {row.description}
                                                                        {isPurchase && (
                                                                            <button 
                                                                                onClick={() => {
                                                                                    const poNo = row.description.split(': ')[1]?.split(' ')[0];
                                                                                    const po = purchases.find(p => p.purchase_no === poNo);
                                                                                    if (po) setViewingPurchase(po);
                                                                                    else toast.error('Data PO asli tidak ditemukan');
                                                                                }}
                                                                                className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                                                                title="Lihat Rincian Barang"
                                                                            >
                                                                                <Eye className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right text-green-600 font-bold">{row.debit > 0 ? `Rp ${row.debit.toLocaleString()}` : '-'}</td>
                                                                <td className="px-6 py-4 text-right text-red-600 font-bold">{row.credit > 0 ? `Rp ${row.credit.toLocaleString()}` : '-'}</td>
                                                                <td className="px-6 py-4 text-right font-black text-gray-900 bg-gray-50/20 group-hover:bg-primary/5 transition-all">Rp {row.balance.toLocaleString()}</td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button 
                                                                            onClick={() => {
                                                                                if (originalTx) {
                                                                                    setEditingJournal(originalTx);
                                                                                    setIsJournalModalOpen(true);
                                                                                }
                                                                            }}
                                                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                            title="Edit Transaksi"
                                                                        >
                                                                            <Edit className="w-3 h-3" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => {
                                                                                if (originalTx && confirm('Hapus transaksi ini?')) {
                                                                                    onDeleteTransaction(originalTx.id);
                                                                                }
                                                                            }}
                                                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                            title="Hapus Transaksi"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}

                                                    {rows.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Tidak ada mutasi transaksi pada periode ini.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="p-6 bg-gray-50 border-t grid grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Debit (+)</p>
                                                <p className="text-lg font-bold text-green-600">Rp {totalDebit.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Kredit (-)</p>
                                                <p className="text-lg font-bold text-red-600">Rp {totalCredit.toLocaleString()}</p>
                                            </div>
                                            <div className="lg:col-span-2 text-right">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Saldo Akhir</p>
                                                <div className="inline-flex items-center gap-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${saldoAkhir >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {isDebitNormal ? (saldoAkhir >= 0 ? 'DEBIT' : 'KREDIT') : (saldoAkhir >= 0 ? 'KREDIT' : 'DEBIT')}
                                                    </span>
                                                    <p className="text-2xl font-black text-gray-900 font-mono">Rp {saldoAkhir.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}
                {activeTab === 'income' && renderReports('income')}
                {activeTab === 'hpp' && (
                    <HppReportTab
                        startDate={startDate}
                        endDate={endDate}
                        currentBranchId={currentBranchId || sales[0]?.branch_id || ''}
                        storeSettings={storeSettings}
                    />
                )}
                {activeTab === 'balance' && renderFinancialPosition()}
                {activeTab === 'accounts' && (
                    <div className="space-y-4 p-4 md:p-8">
                        {accounts.length === 0 && (
                            <div className="bg-orange-50 border border-orange-200 p-8 rounded-2xl text-center">
                                <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-orange-800 mb-2">Daftar Akun Kosong</h3>
                                <p className="text-orange-600 mb-6">Sistem mendeteksi belum ada daftar akun akuntansi. Klik tombol di bawah untuk membuat akun standar (Kas, Bank, Hutang, dsb).</p>
                                <Button 
                                    onClick={async () => {
                                        const loading = toast.loading('Membuat akun standar...');
                                        try {
                                            // Call the SQL we prepared via RPC or just multiple inserts
                                            const defaultAccounts = [
                                                { code: '101', name: 'Kas', type: 'Asset' },
                                                { code: '102', name: 'Bank', type: 'Asset' },
                                                { code: '105', name: 'Kas Kecil', type: 'Asset' },
                                                { code: '201', name: 'Hutang Usaha', type: 'Liability' },
                                                { code: '301', name: 'Modal', type: 'Equity' },
                                                { code: '401', name: 'Pendapatan Penjualan', type: 'Income' },
                                                { code: '501', name: 'Pembelian Bahan Baku', type: 'Expense' }
                                            ];
                                            await supabase.from('accounts').upsert(defaultAccounts);
                                            if (onRefresh) await onRefresh();
                                            toast.success('Akun Standar Berhasil Dibuat', { id: loading });
                                        } catch (e) {
                                            toast.error('Gagal membuat akun', { id: loading });
                                        }
                                    }}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-orange-200"
                                >
                                    Inisialisasi Akun Standar
                                </Button>
                            </div>
                        )}
                        <div className="flex justify-end mt-4 mb-4">
                            <Button 
                                onClick={async () => {
                                    const toastId = toast.loading('Mensinkronkan penjualan ke akuntansi...');
                                    try {
                                        const { data: salesData, error: salesError } = await supabase.from('sales').select('id, date, order_no, total_amount, status').in('status', ['paid', 'completed', 'selesai', 'settlement', 'served', 'capture', 'success', 'ready']);
                                        if (salesError) throw salesError;

                                        const { data: journalData, error: journalError } = await supabase.from('journal_entries').select('reference_id').eq('source_type', 'sale');
                                        if (journalError) throw journalError;

                                        const existingIds = new Set(journalData?.map(j => j.reference_id) || []);
                                        const missingSales = salesData?.filter(s => !existingIds.has(String(s.id))) || [];

                                        if (missingSales.length === 0) {
                                            toast.success('Semua data penjualan POS sudah tersinkron dengan akuntansi!', { id: toastId });
                                            return;
                                        }

                                        const entries = missingSales.map(s => ({
                                            date: s.date ? String(s.date).split('T')[0] : new Date().toISOString().split('T')[0],
                                            description: `Penjualan POS #${s.order_no}`,
                                            debit_account: '101', 
                                            credit_account: '401', 
                                            amount: Math.round(Number(s.total_amount)),
                                            reference_id: String(s.id),
                                            source_type: 'sale'
                                        }));

                                        for (let i = 0; i < entries.length; i += 100) {
                                            const batch = entries.slice(i, i + 100);
                                            const { error: insertError } = await supabase.from('journal_entries').insert(batch);
                                            if (insertError) throw insertError;
                                        }

                                        toast.success(`Berhasil mensinkronkan ${missingSales.length} data penjualan lama ke akuntansi!`, { id: toastId });
                                        if (onRefresh) await onRefresh();
                                    } catch (err: any) {
                                        toast.error('Gagal sinkronisasi: ' + err.message, { id: toastId });
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-2 rounded-xl"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Sinkronkan POS Penjualan ke Akuntansi
                            </Button>
                        </div>
                        <AccountManagementTab
                            accounts={accounts}
                            getBalance={(code) => getDisplayBalance(code, true)}
                            onAddAccount={addAccount}
                            onUpdateAccount={updateAccount}
                            onDeleteAccount={deleteAccount}
                            onMoveAccount={moveAccount}
                            onViewLedger={(code) => {
                                setSelectedLedgerAccount(code);
                                setActiveTab('ledger');
                            }}
                        />
                    </div>
                )}
                {/* Modal Rincian Pembelian */}
                {viewingPurchase && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                            <div className="p-8 border-b bg-gradient-to-br from-gray-50 to-white flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black tracking-widest uppercase">Detail Pembelian</span>
                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black tracking-widest uppercase">{viewingPurchase.purchase_no}</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-800 leading-tight">
                                        {viewingPurchase.supplier_name || 'Supplier Umum'}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1 font-medium">{new Date(viewingPurchase.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <button 
                                    onClick={() => setViewingPurchase(null)}
                                    className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-2xl transition-all hover:rotate-90"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status Pembelian</p>
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                                viewingPurchase.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {viewingPurchase.status}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Metode Bayar</p>
                                            <p className="font-bold text-gray-700">{viewingPurchase.payment_method || 'Tunai'}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Daftar Item Barang</h4>
                                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-500 font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Item</th>
                                                        <th className="px-4 py-3 text-center">Qty</th>
                                                        <th className="px-4 py-3 text-right">Harga</th>
                                                        <th className="px-4 py-3 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {(viewingPurchase.items || []).map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50">
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-gray-700">{item.name}</div>
                                                                <div className="text-[10px] text-gray-400">{item.unit || 'Satuan'}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-bold text-gray-600">{item.quantity}</td>
                                                            <td className="px-4 py-3 text-right">Rp {Number(item.price).toLocaleString()}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-800">Rp {(Number(item.price) * Number(item.quantity)).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {viewingPurchase.notes && (
                                        <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Catatan Tambahan</p>
                                            <p className="text-sm text-gray-600 italic">"{viewingPurchase.notes}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50 border-t flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Pembelian</p>
                                    <p className="text-3xl font-black text-blue-700">Rp {Number(viewingPurchase.total_amount).toLocaleString()}</p>
                                </div>
                                <Button 
                                    onClick={() => setViewingPurchase(null)}
                                    className="px-8 py-6 rounded-2xl font-black bg-gray-800 hover:bg-black text-white shadow-xl shadow-gray-200"
                                >
                                    TUTUP DETAIL
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
