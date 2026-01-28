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
    DollarSign
} from 'lucide-react';
import { ContactData } from '../contacts/ContactsView';

import { SalesOrder, SalesReturn } from '../pos/SalesView';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';

interface DashboardViewProps {
    contacts: ContactData[];
    sales: SalesOrder[];
    returns: SalesReturn[];
    products: any[];
    ingredients: any[];
    onNavigate: (module: string) => void;
}

export function DashboardView({ contacts = [], sales = [], returns = [], products = [], ingredients = [], onNavigate }: DashboardViewProps) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

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
    const productSales: Record<string, number> = {};
    (sales || []).forEach(sale => {
        if (sale.status !== 'Returned' && Array.isArray(sale.productDetails)) {
            sale.productDetails.forEach((item: any) => {
                if (item && item.name) {
                    productSales[item.name] = (productSales[item.name] || 0) + (item.quantity || 0);
                }
            });
        }
    });

    const bestSellers = Object.entries(productSales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const stats = [
        {
            label: 'Total Penjualan Hari Ini',
            value: `Rp ${revenueToday.toLocaleString()}`,
            icon: DollarSign,
            trend: '+12.5%', // Needs historical data for real trend
            trendUp: true,
            gradient: 'from-green-500 to-emerald-600',
            shadow: 'shadow-green-500/20'
        },
        {
            label: 'Total Transaksi',
            value: transactionsToday.toString(),
            icon: ShoppingBag,
            trend: '+8.2%',
            trendUp: true,
            gradient: 'from-blue-500 to-indigo-600',
            shadow: 'shadow-blue-500/20'
        },
        {
            label: 'Total Pelanggan',
            value: totalCustomers.toString(),
            icon: Users,
            trend: '+2',
            trendUp: true,
            gradient: 'from-orange-500 to-pink-600',
            shadow: 'shadow-orange-500/20'
        },
        {
            label: 'Stok Menipis',
            value: lowStockItems.length.toString(),
            icon: Package,
            trend: lowStockItems.length > 0 ? 'Perlu Restock' : 'Aman',
            trendUp: lowStockItems.length === 0,
            gradient: 'from-red-500 to-rose-600',
            shadow: 'shadow-red-500/20'
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
                <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-sm border border-gray-100 text-[10px] font-bold text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    LIVE
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
            <div className="grid grid-cols-4 gap-3 shrink-0">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shadow-sm shrink-0`}>
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
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                    <div className="mb-2 shrink-0">
                        <h3 className="text-sm font-bold text-gray-800">Top Produk</h3>
                    </div>
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={bestSellers} margin={{ left: 0, right: 0 }} barGap={2}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 10, fill: '#6b7280' }} />
                                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                                <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 4. Bottom Section: Transactions - Fixed Height */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 shrink-0 h-[130px] flex flex-col">
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <h3 className="text-sm font-bold text-gray-800">Transaksi Terkini</h3>
                    <button onClick={() => onNavigate('pos')} className="text-xs font-bold text-primary flex items-center gap-1">
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
        </div>
    );
}
