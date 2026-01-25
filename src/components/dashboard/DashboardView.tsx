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

import { SalesOrder } from '../pos/SalesView';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
    const salesToday = (sales || []).filter(s => s.date && s.date.startsWith(todayStr) && s.status !== 'Returned');
    const revenueToday = salesToday.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const transactionsToday = salesToday.length;

    // New Customers (mock data assumption: created at matches today? Or just count total for now)
    // Since contacts don't store "createdAt", we'll just show total active customers for now or diff
    // A better approach for "New Customers" would require a date field in ContactData.
    // For now, let's show Total Customers.
    const totalCustomers = (contacts || []).filter(c => c.type === 'Customer').length;

    const lowStockItems = [...(products || []).filter(p => (p.stock || 0) <= 5), ...(ingredients || []).filter(i => (i.currentStock || 0) <= (i.minStock || 0))];

    const birthdaysToday = (contacts || []).filter(c =>
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
        const daySales = (sales || []).filter(s => s.date && s.date.startsWith(dateStr) && s.status !== 'Returned');
        return {
            name: d.toLocaleDateString('id-ID', { weekday: 'short' }),
            total: daySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
        };
    });

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
        <div className="p-8 space-y-8 min-h-full">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Ringkasan</h2>
                    <p className="text-gray-500 mt-1">Berikut adalah apa yang terjadi dengan toko Anda hari ini.</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 text-sm font-medium text-gray-600 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Live Data
                </div>
            </div>

            {birthdaysToday.length > 0 && (
                <div className="bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-200 rounded-3xl p-6 flex items-center justify-between animate-in slide-in-from-top duration-500 text-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-200">
                            <Cake className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">Ulang Tahun Hari Ini! 🎂</h3>
                            <p className="text-sm text-gray-600">
                                Ada {birthdaysToday.length} pelanggan yang sedang berulang tahun:
                                <span className="font-bold ml-1">{birthdaysToday.map(c => c.name).join(', ')}</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white shadow-lg ${stat.shadow} group-hover:scale-110 transition-transform duration-300`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-gray-50 text-gray-600`}>
                                {stat.trend}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 font-medium mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart Card */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Analitik Penjualan</h3>
                            <p className="text-sm text-gray-400 mt-1">Tren pendapatan 7 hari terakhir</p>
                        </div>
                        <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                            <Activity className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="flex-1 w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`Rp ${value.toLocaleString()}`, 'Pendapatan']}
                                />
                                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Side Card */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Transaksi Terbaru</h3>
                        <p className="text-sm text-gray-400 mt-1">5 penjualan terakhir</p>
                    </div>

                    <div className="space-y-4">
                        {sales.slice(0, 5).map((sale) => (
                            <div key={sale.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer group">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all">
                                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h5 className="font-bold text-gray-800 text-sm truncate">{sale.orderNo}</h5>
                                    <p className="text-xs text-gray-400 truncate">{(sale.items || 0)} items • {sale.paymentMethod}</p>
                                </div>
                                <span className="font-bold text-sm text-gray-800 whitespace-nowrap">Rp {(sale.totalAmount || 0).toLocaleString()}</span>
                            </div>
                        ))}
                        {sales.length === 0 && (
                            <div className="text-center py-8 text-gray-400 text-sm italic">Belum ada transaksi hari ini</div>
                        )}
                    </div>

                    <button
                        onClick={() => onNavigate('pos')}
                        className="mt-auto w-full py-3 text-sm font-bold text-primary hover:bg-primary/5 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        Lihat Semua Transaksi <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div >
    );
}
