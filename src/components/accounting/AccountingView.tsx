import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Wallet, FileText, Plus, BookOpen, LayoutDashboard, Settings, Edit, Trash2, Download, CalendarCheck, History, Lock, Unlock, Loader2, ShoppingCart, Search, Eye, X, RefreshCw } from 'lucide-react';
import { PettyCashService, PettyCashSession, PettyCashTransaction } from '../../lib/PettyCashService';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DateRangePicker } from '../shared/DateRangePicker';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

// --- Types & Constants ---

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

interface Account {
    code: string;
    name: string;
    type: AccountType;
    parent_code?: string;
}

interface JournalEntry {
    id: number;
    date: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
}

// --- Sub-Components ---

// --- Sub-Components ---

// ============================================================
// TAB LAPORAN HPP - Snapshot Harga Pokok Penjualan
// ============================================================
function HppReportTab({ startDate, endDate, currentBranchId }: { startDate: string; endDate: string; currentBranchId: string }) {
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [productData, setProductData] = useState<any[]>([]);
    const [allRawItems, setAllRawItems] = useState<any[]>([]); // New state for raw transactions
    const [viewMode, setViewMode] = useState<'monthly' | 'product' | 'transactions'>('monthly');
    const [searchProduct, setSearchProduct] = useState('');
    const [searchTransaction, setSearchTransaction] = useState(''); // Search for raw transactions
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
    }, [localStart, localEnd, currentBranchId]);

    const fetchData = async () => {
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
                        sales!inner(created_at, date, status, branch_id, total_amount, order_no)
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
                    allItems = [...allItems, ...statusOkItems];
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
                        onStartDateChange={setLocalStart} 
                        onEndDateChange={setLocalEnd} 
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
                        onStartDateChange={setLocalStart} 
                        onEndDateChange={setLocalEnd} 
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
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0] || '', desc: '', debit: '', credit: '', amount: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.debit || !formData.credit || !formData.amount) {
            toast.error('Mohon lengkapi data jurnal');
            return;
        }
        const newTx: JournalEntry = {
            id: Date.now(),
            date: formData.date,
            description: formData.desc,
            debitAccount: formData.debit,
            creditAccount: formData.credit,
            amount: parseInt(formData.amount),
        };
        onAddTransaction(newTx);
        setFormData({ ...formData, desc: '', amount: '' });
        toast.success('Jurnal berhasil disimpan');
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
            {/* Input Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" /> Input Jurnal Baru
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                        <input type="date" className="w-full p-2 border rounded-lg" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                        <input type="text" className="w-full p-2 border rounded-lg" placeholder="Contoh: Bayar Listrik" value={formData.desc} onChange={e => setFormData({ ...formData, desc: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-green-700 mb-1">Akun Debit</label>
                            <select className="w-full p-2 border rounded-lg" value={formData.debit} onChange={e => setFormData({ ...formData, debit: e.target.value })}>
                                <option value="">Pilih Akun</option>
                                {accounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-red-700 mb-1">Akun Kredit</label>
                            <select className="w-full p-2 border rounded-lg" value={formData.credit} onChange={e => setFormData({ ...formData, credit: e.target.value })}>
                                <option value="">Pilih Akun</option>
                                {accounts.map(acc => <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp)</label>
                        <input type="number" className="w-full p-2 border rounded-lg" placeholder="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                    </div>
                    <Button type="submit" className="w-full">Simpan Transaksi</Button>
                </form>
            </div>

            {/* Journal Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                                        <option value="Paid">Paid</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
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

function AccountManagementTab({ accounts, getBalance, onAddAccount, onUpdateAccount, onDeleteAccount }: {
    accounts: Account[],
    getBalance: (code: string) => number,
    onAddAccount: (acc: Account) => void,
    onUpdateAccount: (acc: Account) => void,
    onDeleteAccount: (code: string) => void
}) {
    const [formData, setFormData] = useState<Account>({ code: '', name: '', type: 'Asset', parent_code: '' });
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
        setFormData({ code: '', name: '', type: 'Asset', parent_code: '' });
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
                        </select>
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
                                .sort((a,b) => a.code.localeCompare(b.code))
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
                            <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setFormData({ code: '', name: '', type: 'Asset', parent_code: '' }); }}>Batal</Button>
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
                                        .sort((a, b) => a.code.localeCompare(b.code))
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
                                        <tr key={acc.code} className={`border-b hover:bg-gray-50 font-medium ${hasChildren ? 'bg-blue-50/20' : isSubAccount ? 'bg-gray-50/30' : ''}`}>
                                            <td className={`px-4 py-3 ${hasChildren ? 'font-bold text-primary' : isSubAccount ? 'text-gray-400 italic' : 'text-blue-600'}`} style={{ paddingLeft: `${level * 2 + 1}rem` }}>
                                                {isSubAccount && <span className="mr-2">└</span>}
                                                {acc.code}
                                            </td>
                                            <td className={`px-4 py-3 ${hasChildren ? 'font-black text-gray-900' : isSubAccount ? 'text-gray-600' : 'font-bold text-gray-800'}`}>
                                                {acc.name}
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
                                                <button onClick={() => handleEdit(acc)} className="p-1 hover:bg-blue-50 text-blue-600 rounded">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(acc.code)}
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
    transactions?: JournalEntry[];
    sales?: any[]; // [NEW] Added for direct sync
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
    const { user, role } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [journalSearch, setJournalSearch] = useState('');
    
    const [realSales, setRealSales] = useState<any[]>([]);
    const [realPurchases, setRealPurchases] = useState<any[]>([]);
    const [isLoadingRealData, setIsLoadingRealData] = useState(false);


    // --- Date Filtering State ---
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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
            setRealSales(allSales);

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
        fetchRealData();
    }, [startDate, endDate, currentBranchId]);

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

    const getBalance = (code: string) => accountBalances[code] || 0;

    const getDisplayBalance = (code: string) => {
        const raw = getBalance(code);
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
            const groups = {
                asetLancar: accounts.filter(a => a.type === 'Asset' && (parseInt(a.code.replace(/\D/g, '')) || 0) < 120),
                asetTetap: accounts.filter(a => a.type === 'Asset' && (parseInt(a.code.replace(/\D/g, '')) || 0) >= 120),
                utangLancar: accounts.filter(a => a.type === 'Liability' && (parseInt(a.code.replace(/\D/g, '')) || 0) < 220),
                utangJangkaPanjang: accounts.filter(a => a.type === 'Liability' && (parseInt(a.code.replace(/\D/g, '')) || 0) >= 220),
                ekuitas: accounts.filter(a => a.type === 'Equity')
            };

            const totalAsetLancar = groups.asetLancar.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalAsetTetap = groups.asetTetap.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalUtangLancar = groups.utangLancar.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalUtangJangkaPanjang = groups.utangJangkaPanjang.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalEkuitas = groups.ekuitas.reduce((s, a) => s + getDisplayBalance(a.code), 0) + netProfit;

            const data = [
                { 'Kategori': 'ASET', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'ASET LANCAR', 'Nama': '', 'Jumlah': '' },
                ...groups.asetLancar.map(a => ({ 'Kategori': '', 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'TOTAL ASET LANCAR', 'Nama': '', 'Jumlah': totalAsetLancar },
                { 'Kategori': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'ASET TETAP', 'Nama': '', 'Jumlah': '' },
                ...groups.asetTetap.map(a => ({ 'Kategori': '', 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'TOTAL ASET TETAP', 'Nama': '', 'Jumlah': totalAsetTetap },
                { 'Kategori': 'TOTAL ASET', 'Nama': '', 'Jumlah': totalAsetLancar + totalAsetTetap },
                { 'Kategori': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'KEWAJIBAN DAN MODAL', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'UTANG LANCAR', 'Nama': '', 'Jumlah': '' },
                ...groups.utangLancar.map(a => ({ 'Kategori': '', 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'TOTAL UTANG LANCAR', 'Nama': '', 'Jumlah': totalUtangLancar },
                { 'Kategori': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'UTANG JANGKA PANJANG', 'Nama': '', 'Jumlah': '' },
                ...groups.utangJangkaPanjang.map(a => ({ 'Kategori': '', 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'TOTAL UTANG JANGKA PANJANG', 'Nama': '', 'Jumlah': totalUtangJangkaPanjang },
                { 'Kategori': 'TOTAL UTANG', 'Nama': '', 'Jumlah': totalUtangLancar + totalUtangJangkaPanjang },
                { 'Kategori': '', 'Nama': '', 'Jumlah': '' },
                { 'Kategori': 'EKUITAS', 'Nama': '', 'Jumlah': '' },
                ...groups.ekuitas.map(a => ({ 'Kategori': '', 'Nama': a.name, 'Jumlah': getDisplayBalance(a.code) })),
                { 'Kategori': 'Laba Tahun Berjalan', 'Nama': '', 'Jumlah': netProfit },
                { 'Kategori': 'TOTAL EKUITAS', 'Nama': '', 'Jumlah': totalEkuitas },
                { 'Kategori': 'TOTAL UTANG DAN MODAL', 'Nama': '', 'Jumlah': totalUtangLancar + totalUtangJangkaPanjang + totalEkuitas }
            ];

            const worksheet = XLSX.utils.json_to_sheet(data);
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
            doc.text(`Periode: ${startDate} s/d ${endDate}`, 105, 28, { align: 'center' });

            const groups = {
                asetLancar: accounts.filter(a => a.type === 'Asset' && (parseInt(a.code.replace(/\D/g, '')) || 0) < 120),
                asetTetap: accounts.filter(a => a.type === 'Asset' && (parseInt(a.code.replace(/\D/g, '')) || 0) >= 120),
                utangLancar: accounts.filter(a => a.type === 'Liability' && (parseInt(a.code.replace(/\D/g, '')) || 0) < 220),
                utangJangkaPanjang: accounts.filter(a => a.type === 'Liability' && (parseInt(a.code.replace(/\D/g, '')) || 0) >= 220),
                ekuitas: accounts.filter(a => a.type === 'Equity')
            };

            const totalAsetLancar = groups.asetLancar.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalAsetTetap = groups.asetTetap.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalUtangLancar = groups.utangLancar.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalUtangJangkaPanjang = groups.utangJangkaPanjang.reduce((s, a) => s + getDisplayBalance(a.code), 0);
            const totalEkuitas = groups.ekuitas.reduce((s, a) => s + getDisplayBalance(a.code), 0) + netProfit;

            const body: any[] = [
                [{ content: 'ASET', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                [{ content: 'ASET LANCAR', colSpan: 3, styles: { fontStyle: 'bold', textColor: [100, 100, 100] } }],
                ...groups.asetLancar.map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]),
                [{ content: 'TOTAL ASET LANCAR', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalAsetLancar.toLocaleString()}`, styles: { fontStyle: 'bold' } }],
                
                [{ content: 'ASET TETAP', colSpan: 3, styles: { fontStyle: 'bold', textColor: [100, 100, 100] } }],
                ...groups.asetTetap.map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]),
                [{ content: 'TOTAL ASET TETAP', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalAsetTetap.toLocaleString()}`, styles: { fontStyle: 'bold' } }],
                
                [{ content: 'TOTAL ASET', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }, { content: `Rp ${(totalAsetLancar + totalAsetTetap).toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }],
                
                [{ content: 'KEWAJIBAN DAN MODAL', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                [{ content: 'UTANG LANCAR', colSpan: 3, styles: { fontStyle: 'bold', textColor: [100, 100, 100] } }],
                ...groups.utangLancar.map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]),
                [{ content: 'TOTAL UTANG LANCAR', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalUtangLancar.toLocaleString()}`, styles: { fontStyle: 'bold' } }],

                [{ content: 'UTANG JANGKA PANJANG', colSpan: 3, styles: { fontStyle: 'bold', textColor: [100, 100, 100] } }],
                ...groups.utangJangkaPanjang.map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]),
                [{ content: 'TOTAL UTANG JANGKA PANJANG', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalUtangJangkaPanjang.toLocaleString()}`, styles: { fontStyle: 'bold' } }],
                [{ content: 'TOTAL UTANG', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${(totalUtangLancar + totalUtangJangkaPanjang).toLocaleString()}`, styles: { fontStyle: 'bold' } }],

                [{ content: 'EKUITAS', colSpan: 3, styles: { fontStyle: 'bold', textColor: [100, 100, 100] } }],
                ...groups.ekuitas.map(a => [a.code, a.name, `Rp ${getDisplayBalance(a.code).toLocaleString()}`]),
                ['-', 'Laba Tahun Berjalan', `Rp ${netProfit.toLocaleString()}`],
                [{ content: 'TOTAL EKUITAS', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: `Rp ${totalEkuitas.toLocaleString()}`, styles: { fontStyle: 'bold' } }],
                
                [{ content: 'TOTAL UTANG DAN MODAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }, { content: `Rp ${(totalUtangLancar + totalUtangJangkaPanjang + totalEkuitas).toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }],
            ];

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

    const renderFinancialPosition = () => {
        const renderAccountRows = (parentCode: string | undefined, level: number = 0): { rows: React.ReactNode[], subTotal: number } => {
            let total = 0;
            const children = accounts.filter(a => a.parent_code === parentCode).sort((a, b) => a.code.localeCompare(b.code));
            
            const rows = children.flatMap(acc => {
                const balance = getDisplayBalance(acc.code);
                const subHierarchy = renderAccountRows(acc.code, level + 1);
                const currentTotal = balance + subHierarchy.subTotal;
                total += currentTotal;

                const hasChildren = accounts.some(a => a.parent_code === acc.code);

                return [
                    <div key={acc.code} className={`${hasChildren ? 'mt-4' : ''}`}>
                        <div className={`flex justify-between py-1 border-b border-dashed border-gray-100 ${hasChildren ? 'font-bold text-gray-800' : 'text-sm text-gray-600'}`} style={{ paddingLeft: `${level * 1.5}rem` }}>
                            <span>{acc.code} - {acc.name}</span>
                            <span>Rp {currentTotal.toLocaleString()}</span>
                        </div>
                        {subHierarchy.rows}
                    </div>
                ];
            });

            return { rows, subTotal: total };
        };

        const assetSections = renderAccountRows(undefined).rows.filter((_, i) => {
            const acc = accounts.filter(a => !a.parent_code).sort((a, b) => a.code.localeCompare(b.code))[i];
            return acc?.type === 'Asset';
        });

        const liabilitySections = renderAccountRows(undefined).rows.filter((_, i) => {
            const acc = accounts.filter(a => !a.parent_code).sort((a, b) => a.code.localeCompare(b.code))[i];
            return acc?.type === 'Liability';
        });

        const equitySections = renderAccountRows(undefined).rows.filter((_, i) => {
            const acc = accounts.filter(a => !a.parent_code).sort((a, b) => a.code.localeCompare(b.code))[i];
            return acc?.type === 'Equity';
        });

        const totalAset = accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalUtang = accounts.filter(a => a.type === 'Liability').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalEkuitasWithoutProfit = accounts.filter(a => a.type === 'Equity').reduce((s, a) => s + getDisplayBalance(a.code), 0);
        const totalEkuitas = totalEkuitasWithoutProfit + netProfit;

        return (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">
                            Laporan Posisi Keuangan
                        </h2>
                        <p className="text-gray-500">WinPOS Enterprise • Per {endDate}</p>
                    </div>
                    <div className="flex gap-2">
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
                        <h3 className="font-black text-lg text-blue-700 border-b-2 border-blue-700 pb-1 uppercase">Aktiva (Aset)</h3>
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
                            <h3 className="font-black text-lg text-red-700 border-b-2 border-red-700 pb-1 uppercase">Kewajiban (Utang)</h3>
                            <div className="mt-4 space-y-4">
                                {liabilitySections}
                            </div>
                            <div className="flex justify-between font-bold text-gray-900 mt-4 p-3 bg-gray-50 rounded-lg border">
                                <span>TOTAL UTANG</span>
                                <span>Rp {totalUtang.toLocaleString()}</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-black text-lg text-emerald-700 border-b-2 border-emerald-700 pb-1 uppercase">Ekuitas & Modal</h3>
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
        { id: 'journal', label: 'Jurnal Umum', icon: Plus },
        { id: 'pettycash', label: 'Kas Kecil', icon: Wallet },
        { id: 'purchase_history', label: 'Riwayat Pembelian', icon: ShoppingCart },
        { id: 'ledger', label: 'Buku Besar', icon: BookOpen },
        { id: 'hpp', label: 'Laporan HPP', icon: TrendingDown },
        { id: 'income', label: 'Laba Rugi', icon: TrendingUp },
        { id: 'balance', label: 'Neraca', icon: FileText },
        { id: 'accounts', label: 'Daftar Akun', icon: Settings },
    ];

    return (
        <div className="p-8 space-y-8 min-h-full bg-gray-50/50">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Modul Akuntansi</h2>
                    <p className="text-sm text-gray-500">Pencatatan keuangan standar akuntansi Indonesia.</p>
                </div>
                {onBack && (
                    <Button
                        onClick={onBack}
                        variant="outline"
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                        <LayoutDashboard className="w-4 h-4 rotate-180 text-gray-500" />
                        Kembali ke Payroll
                    </Button>
                )}
                <div className="flex gap-2">
                    <Button
                        onClick={() => {
                            if (onRefresh) onRefresh();
                            toast.info('Memperbarui data akuntansi...');
                        }}
                        variant="outline"
                        className="flex items-center gap-2 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                    >
                        <Plus className="w-4 h-4 rotate-45" /> 
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Navigation Tabs & Date Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-xl w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <DateRangePicker 
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(range) => {
                        setStartDate(range.startDate);
                        setEndDate(range.endDate);
                    }}
                />
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
                    <PurchaseHistoryTab purchases={realPurchases} onCRUD={onPurchaseCRUD} />
                )}

                {activeTab === 'ledger' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border text-center">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-800">Buku Besar</h3>
                        <p className="text-gray-500">Pilih akun untuk melihat detail pergerakan saldo periode {startDate} s/d {endDate}.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 text-left">
                            {accounts.map(acc => (
                                <div 
                                    key={acc.code} 
                                    onClick={() => {
                                        setJournalSearch(acc.code);
                                        setActiveTab('journal');
                                        toast.info(`Menampilkan jurnal untuk akun: ${acc.name}`);
                                    }}
                                    className="p-4 border rounded-xl hover:bg-primary/5 hover:border-primary/30 cursor-pointer group transition-all"
                                >
                                    <div className="font-bold text-gray-700 group-hover:text-primary">{acc.code} - {acc.name}</div>
                                    <div className="text-xs text-gray-400 uppercase mt-1">{acc.type}</div>
                                    <div className="text-right font-mono font-bold mt-2">Rp {getDisplayBalance(acc.code).toLocaleString()}</div>
                                    <div className="text-[10px] text-primary font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">KLIK UNTUK LIHAT JURNAL →</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'income' && renderReports('income')}
                {activeTab === 'hpp' && (
                    <HppReportTab
                        startDate={startDate}
                        endDate={endDate}
                        currentBranchId={currentBranchId || sales[0]?.branch_id || ''}
                    />
                )}
                {activeTab === 'balance' && renderFinancialPosition()}
                {activeTab === 'accounts' && (
                    <AccountManagementTab
                        accounts={accounts}
                        getBalance={getDisplayBalance}
                        onAddAccount={addAccount}
                        onUpdateAccount={updateAccount}
                        onDeleteAccount={deleteAccount}
                    />
                )}
            </div>
        </div>
    );
}
