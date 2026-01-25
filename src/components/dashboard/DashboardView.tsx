import {
    TrendingUp,
    Users,
    Package,
    CreditCard,
    DollarSign,
    ShoppingBag,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Cake,
    ChevronRight
} from 'lucide-react';
import { ContactData } from '../contacts/ContactsView';

interface DashboardViewProps {
    contacts: ContactData[];
}

export function DashboardView({ contacts }: DashboardViewProps) {
    const today = new Date();
    const birthdaysToday = contacts.filter(c =>
        c.type === 'Customer' &&
        c.birthday &&
        new Date(c.birthday).getMonth() === today.getMonth() &&
        new Date(c.birthday).getDate() === today.getDate()
    );

    const stats = [
        {
            label: 'Total Penjualan Hari Ini',
            value: 'Rp 2.500.000',
            icon: DollarSign,
            trend: '+12.5%',
            trendUp: true,
            gradient: 'from-green-500 to-emerald-600',
            shadow: 'shadow-green-500/20'
        },
        {
            label: 'Total Transaksi',
            value: '24',
            icon: ShoppingBag,
            trend: '+8.2%',
            trendUp: true,
            gradient: 'from-blue-500 to-indigo-600',
            shadow: 'shadow-blue-500/20'
        },
        {
            label: 'Pelanggan Baru',
            value: '5',
            icon: Users,
            trend: '-2.4%',
            trendUp: false,
            gradient: 'from-orange-500 to-pink-600',
            shadow: 'shadow-orange-500/20'
        },
        {
            label: 'Stok Menipis',
            value: '3',
            icon: Package,
            trend: '0%',
            trendUp: true,
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 text-sm font-medium text-gray-600">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Pembaruan Langsung
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
                            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${stat.trendUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                }`}>
                                {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
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
                            <p className="text-sm text-gray-400 mt-1">Performa bulanan</p>
                        </div>
                        <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                            <Activity className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <TrendingUp className="w-8 h-8 text-primary" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Visualisasi Grafik</h4>
                        <p className="text-sm text-gray-500 max-w-sm mt-2 px-4">
                            Representasi data visual akan diimplementasikan menggunakan pustaka grafik seperti Recharts atau Chart.js.
                        </p>
                    </div>
                </div>

                {/* Side Card */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Transaksi Terbaru</h3>
                        <p className="text-sm text-gray-400 mt-1">5 penjualan terakhir</p>
                    </div>

                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((item) => (
                            <div key={item} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer group">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all">
                                    <ShoppingBag className="w-4 h-4 text-gray-500 group-hover:text-primary" />
                                </div>
                                <div className="flex-1">
                                    <h5 className="font-bold text-gray-800 text-sm">Pesanan #{1000 + item}</h5>
                                    <p className="text-xs text-gray-400">2 item</p>
                                </div>
                                <span className="font-bold text-sm text-gray-800">Rp 45.000</span>
                            </div>
                        ))}
                    </div>

                    <button className="mt-auto w-full py-3 text-sm font-bold text-primary hover:bg-primary/5 rounded-xl transition-colors">
                        Lihat Semua Transaksi
                    </button>
                </div>
            </div>
        </div >
    );
}
