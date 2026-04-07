import {
    TrendingUp,
    Users,
    Package,
    ShoppingBag,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Cake,
    ChevronRight,
    DollarSign,
    Printer,
    X
} from 'lucide-react';
import { ContactData } from '../contacts/ContactsView';
import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

import { SalesOrder, SalesReturn } from '../pos/SalesView';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';

export interface DashboardViewProps {
    contacts: ContactData[];
    sales: SalesOrder[];
    returns: SalesReturn[];
    products: any[];
    ingredients: any[];
    voucherStats?: { total: number; used: number; available: number };
    storeSettings?: any;
    onNavigate: (module: string, tab?: any) => void;
}

export function DashboardView({ 
    contacts = [], 
    sales = [], 
    returns = [], 
    products = [], 
    ingredients = [], 
    voucherStats = { total: 0, used: 0, available: 0 }, 
    storeSettings,
    onNavigate 
}: DashboardViewProps) {
    const [showDailyReceipt, setShowDailyReceipt] = useState(false);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const [reportStartDate, setReportStartDate] = useState(todayStr);
    const [reportEndDate, setReportEndDate] = useState(todayStr);

    // --- Real Stats Calculation ---
    const salesToday = (sales || []).filter(s => s && s.date && s.date.startsWith(todayStr) && s.status !== 'Returned');
    const revenueToday = salesToday.reduce((sum, s) => sum + (s && s.totalAmount ? s.totalAmount : 0), 0);
    const transactionsToday = salesToday.length;

    // New Customers (mock data assumption: created at matches today? Or just count total for now)
    // Since contacts don't store "createdAt", we'll just show total active customers for now or diff
    // A better approach for "New Customers" would require a date field in ContactData.
    // For now, let's show Total Customers.
    const totalCustomers = (contacts || []).filter(c => c && c.type === 'Customer').length;

    const lowStockItems = [
        ...(products || []).filter(p => p && (p.stock || 0) <= 5),
        ...(ingredients || []).filter(i => i && (i.currentStock || 0) <= (i.minStock || 0))
    ];

    const birthdaysToday = (contacts || []).filter(c =>
        c &&
        c.type === 'Customer' &&
        c.birthday &&
        new Date(c.birthday).getMonth() === today.getMonth() &&
        new Date(c.birthday).getDate() === today.getDate()
    );

    // --- Chart Data (Last 7 Days) ---
    const chartData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const daySales = (sales || []).filter(s => s && s.date && s.date.startsWith(dateStr) && s.status !== 'Returned');
        return {
            name: d.toLocaleDateString('id-ID', { weekday: 'short' }),
            total: daySales.reduce((sum, s) => sum + (s && s.totalAmount ? s.totalAmount : 0), 0)
        };
    });

    // --- Best Sellers Calculation ---
    const coffeeSales: Record<string, number> = {};
    const nonCoffeeSales: Record<string, number> = {};

    (sales || []).forEach(sale => {
        if (sale.status !== 'Returned' && Array.isArray(sale.productDetails)) {
            sale.productDetails.forEach((item: any) => {
                if (item && item.name) {
                    const category = (item.category || '').toLowerCase();
                    const lowerName = item.name.toLowerCase();
                    if (category.includes('kopi') || lowerName.startsWith('kopi')) {
                        coffeeSales[item.name] = (coffeeSales[item.name] || 0) + (item.quantity || 0);
                    } else {
                        nonCoffeeSales[item.name] = (nonCoffeeSales[item.name] || 0) + (item.quantity || 0);
                    }
                }
            });
        }
    });

    const coffeeBestSellers = Object.entries(coffeeSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const nonCoffeeBestSellers = Object.entries(nonCoffeeSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // --- Daily Receipt Calculations (Filtered by Date Range) ---
    const reportSales = useMemo(() => {
        return (sales || []).filter(s => {
            if (!s || !s.date || s.status === 'Returned') return false;
            const saleDate = s.date.split('T')[0];
            return saleDate >= reportStartDate && saleDate <= reportEndDate;
        });
    }, [sales, reportStartDate, reportEndDate]);

    const dailyTax = useMemo(() => reportSales.reduce((acc, s) => acc + (s.tax || 0), 0), [reportSales]);
    const dailyDiscount = useMemo(() => reportSales.reduce((acc, s) => acc + (s.discount || 0), 0), [reportSales]);
    const paymentBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        reportSales.forEach(s => {
            if (s.status === 'Completed') {
                counts[s.paymentMethod] = (counts[s.paymentMethod] || 0) + s.totalAmount;
            }
        });
        return Object.entries(counts).map(([name, total]) => ({ name, total }));
    }, [reportSales]);

    const dailyNetTotal = useMemo(() => reportSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0), [reportSales]);
    const subtotalGross = dailyNetTotal + dailyDiscount - dailyTax;

    const handlePrint = () => {
        window.print();
    };

    const stats = [
        {
            label: 'Total Penjualan Hari Ini',
            value: `Rp ${revenueToday.toLocaleString()}`,
            icon: DollarSign,
            trend: '+12.5%', // Needs historical data for real trend
            trendUp: true,
            gradient: 'from-green-500 to-emerald-600',
            shadow: 'shadow-green-500/20',
            module: 'pos',
            tab: 'history'
        },
        {
            label: 'Total Transaksi',
            value: transactionsToday.toString(),
            icon: ShoppingBag,
            trend: '+8.2%',
            trendUp: true,
            gradient: 'from-blue-500 to-indigo-600',
            shadow: 'shadow-blue-500/20',
            module: 'pos',
            tab: 'history'
        },
        {
            label: 'Total Pelanggan',
            value: totalCustomers.toString(),
            icon: Users,
            trend: '+2',
            trendUp: true,
            gradient: 'from-orange-500 to-pink-600',
            shadow: 'shadow-orange-500/20',
            module: 'contacts'
        },
        {
            label: 'Stok Menipis',
            value: lowStockItems.length.toString(),
            icon: Package,
            trend: lowStockItems.length > 0 ? 'Perlu Restock' : 'Aman',
            trendUp: lowStockItems.length === 0,
            gradient: 'from-red-500 to-rose-600',
            shadow: 'shadow-red-500/20',
            module: 'inventory'
        },
        {
            label: 'Voucher WiFi',
            value: (voucherStats?.available || 0).toString(),
            icon: Activity,
            trend: (voucherStats?.available || 0) < 10 ? 'Segera Import' : 'Cukup',
            trendUp: (voucherStats?.available || 0) >= 10,
            gradient: (voucherStats?.available || 0) < 10 ? 'from-orange-600 to-red-700' : 'from-emerald-500 to-teal-600',
            shadow: 'shadow-orange-500/20',
            module: 'settings'
        },
    ];

    return (
        <div className="p-4 h-full flex flex-col gap-3 overflow-hidden">
            {/* 1. Header Section - Fixed Height */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Ringkasan</h2>
                    <p className="text-xs text-gray-500">Overview Toko</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setShowDailyReceipt(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 h-9 rounded-xl shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        Cetak Laporan Hari Ini
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-sm border border-gray-100 text-[10px] font-bold text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        LIVE
                    </div>
                </div>
            </div>

            {/* Birthday Alert - Conditional */}
            {birthdaysToday.length > 0 && (
                <div className="bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-200 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-top duration-500 mb-1 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                            <Cake className="w-4 h-4" />
                        </div>
                        <div className="text-xs">
                            <span className="font-bold text-gray-800">Ulang Tahun:</span> {birthdaysToday.map(c => c.name).join(', ')}
                        </div>
                    </div>
                </div>
            )}


            {/* 2. Stats Grid - Fixed Height */}
            <div className="grid grid-cols-5 gap-3 shrink-0">
                {stats.map((stat, index) => (
                    <div 
                        key={index} 
                        onClick={() => stat.module && onNavigate(stat.module, stat.tab)}
                        className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-110 transition-transform`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-400 font-medium truncate">{stat.label}</p>
                            <h3 className="text-lg font-bold text-gray-800 leading-tight">{stat.value}</h3>
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">{stat.trend}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. Middle Section: Charts - FLEX GROW (Takes all remaining space) */}
            <div className="grid grid-cols-3 gap-3 min-h-0 flex-1">
                {/* Main Chart */}
                <div className="col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2 shrink-0">
                        <h3 className="text-sm font-bold text-gray-800">Analitik Penjualan</h3>
                        <Activity className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={5} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(val) => `${val / 1000}k`} />
                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Best Sellers */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
                    <div className="mb-2 shrink-0 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-800">Top Produk</h3>
                        <button onClick={() => onNavigate('products')} className="text-[9px] font-bold text-primary flex items-center gap-0.5 hover:underline">
                            Lihat Semua <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 w-full overflow-y-auto space-y-4">
                        {/* Kopi Chart */}
                        <div className="h-1/2 flex flex-col">
                            <h4 className="text-[10px] font-bold text-orange-600 uppercase mb-1 tracking-wider">Kopi</h4>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={coffeeBestSellers} margin={{ left: -20, right: 10 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 9, fill: '#6b7280' }} />
                                        <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                        <Bar dataKey="value" fill="#ea580c" radius={[0, 4, 4, 0]} barSize={10} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Non-Kopi Chart */}
                        <div className="h-1/2 flex flex-col">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-1 tracking-wider">Non-Kopi</h4>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={nonCoffeeBestSellers} margin={{ left: -20, right: 10 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 9, fill: '#6b7280' }} />
                                        <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '10px' }} />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={10} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Bottom Section: Transactions - Fixed Height */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 shrink-0 h-[130px] flex flex-col">
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <h3 className="text-sm font-bold text-gray-800">Transaksi Terkini</h3>
                    <button onClick={() => onNavigate('pos', 'history')} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                        Lihat Semua <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-3 overflow-hidden">
                    {sales.slice(0, 4).map((sale) => (
                        <div key={sale.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div className="min-w-0 overflow-hidden">
                                <h5 className="font-bold text-gray-800 text-xs truncate">{sale.orderNo}</h5>
                                <span className="text-[10px] font-bold text-gray-500">Rp {(sale.totalAmount || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Sales Receipt Modal */}
            {showDailyReceipt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl relative print:shadow-none print:max-h-none print:w-full">
                        {/* Header Modal (Hidden on Print) */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between print:hidden">
                            <div className="flex-1 mr-4">
                                <h3 className="font-bold text-gray-800">Bukti Fisik Transaksi</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <input 
                                        type="date" 
                                        value={reportStartDate} 
                                        onChange={(e) => setReportStartDate(e.target.value)}
                                        className="text-xs px-2 py-1 border rounded-md focus:ring-1 focus:ring-orange-500 outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-gray-400">s/d</span>
                                    <input 
                                        type="date" 
                                        value={reportEndDate} 
                                        onChange={(e) => setReportEndDate(e.target.value)}
                                        className="text-xs px-2 py-1 border rounded-md focus:ring-1 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowDailyReceipt(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Receipt Content */}
                        <div className="flex-1 overflow-y-auto p-8 print:p-0 bg-gray-100 print:bg-white scrollbar-thin scrollbar-thumb-gray-200">
                            <div className="bg-white p-8 shadow-sm mx-auto print:shadow-none print:p-0 print:m-0" 
                                 style={{ 
                                     width: storeSettings?.receipt_paper_width === '80mm' ? '400px' : '300px',
                                     maxWidth: '100%',
                                     fontFamily: 'monospace'
                                 }}>
                                
                                {/* Receipt Header */}
                                <div className="text-center space-y-1 mb-4">
                                    {storeSettings?.show_logo && storeSettings?.receipt_logo_url && (
                                        <div className="flex justify-center mb-3">
                                            <img src={storeSettings.receipt_logo_url} alt="Logo" className="w-16 h-16 object-contain grayscale" />
                                        </div>
                                    )}
                                    <h4 className="font-bold text-lg uppercase">{(storeSettings?.receipt_header || 'WINNY POS').toUpperCase()}</h4>
                                    {storeSettings?.address && <p className="text-[11px] whitespace-pre-line">{storeSettings.address}</p>}
                                    {storeSettings?.phone && <p className="text-[11px]">Telp: {storeSettings.phone}</p>}
                                    <div className="py-2">--------------------------------</div>
                                    <h5 className="font-bold text-sm">LAPORAN TRANSAKSI</h5>
                                    <p className="text-[11px] font-bold">
                                        {reportStartDate === reportEndDate 
                                            ? new Date(reportStartDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                            : `${new Date(reportStartDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} s/d ${new Date(reportEndDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                                        }
                                    </p>
                                    <div className="py-1">================================</div>
                                </div>

                                {/* Summary */}
                                <div className="space-y-1 text-[12px]">
                                    <div className="flex justify-between">
                                        <span className="font-bold tracking-tighter uppercase">RINGKASAN</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Transaksi:</span>
                                        <span>{reportSales.length}</span>
                                    </div>
                                    <div className="flex justify-between font-bold border-t border-gray-200 mt-2 pt-1">
                                        <span>TOTAL BERSIH (NET):</span>
                                        <span>Rp {(reportSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0)).toLocaleString('id-ID')}</span>
                                    </div>
                                    
                                    {/* Tax/Discount Details */}
                                    <div className="flex justify-between mt-1 text-gray-500">
                                        <span>Subtotal Kotor:</span>
                                        <span>{subtotalGross.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Pajak (+):</span>
                                        <span>{dailyTax.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Diskon (-):</span>
                                        <span>{dailyDiscount.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>

                                <div className="py-2 text-center">--------------------------------</div>

                                {/* Payment Breakdown */}
                                <div className="space-y-1 text-[12px]">
                                    <span className="font-bold tracking-tighter uppercase">DETAIL PEMBAYARAN</span>
                                    {paymentBreakdown.map((m, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span>{m.name.toUpperCase()}:</span>
                                            <span>{m.total.toLocaleString('id-ID')}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="py-4 text-center">--------------------------------</div>

                                {/* Footer */}
                                <div className="text-center text-[10px] space-y-1 text-gray-500">
                                    <p>Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
                                    <p className="font-bold text-black border border-black p-1 inline-block mt-2">BUKTI FISIK SAH</p>
                                    
                                    {storeSettings?.receipt_footer && (
                                        <div className="pt-4 text-black text-[11px]">
                                            <p>{storeSettings.receipt_footer}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Print Control (Hidden on Print) */}
                        <div className="p-6 border-t border-gray-100 flex gap-3 print:hidden">
                            <Button variant="outline" className="flex-1" onClick={() => setShowDailyReceipt(false)}>
                                Batal
                            </Button>
                            <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold" onClick={handlePrint}>
                                <Printer className="w-4 h-4 mr-2" />
                                Cetak Struk Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
