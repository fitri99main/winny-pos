import { useState, useEffect } from 'react';
import { ChefHat, Coffee, CheckCircle2, Clock, MapPin, User, ChevronRight, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface KDSItem {
    name: string;
    quantity: number;
    target: 'Kitchen' | 'Bar' | 'Waitress';
    status: 'Pending' | 'Preparing' | 'Ready' | 'Served';
}

interface KDSViewProps {
    orders: any[]; // Changed from pendingOrders to generic orders (Sales[])
    onUpdateStatus: (orderId: number, status: string, items?: any) => void;
}

export function KDSView({ orders = [], onUpdateStatus }: KDSViewProps) {
    const [filter, setFilter] = useState<'All' | 'Kitchen' | 'Bar'>('All');
    const [isSplitView, setIsSplitView] = useState(false);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000); // 30s update
        return () => clearInterval(interval);
    }, []);

    const getElapsedTime = (dateStr: string) => {
        if (!dateStr) return '0 mnt';
        const start = new Date(dateStr).getTime();
        const diff = now.getTime() - start;
        const minutes = Math.floor(diff / 60000);
        return `${minutes} mnt`;
    };

    // Helper to map DB sales to KDS format
    const kdsOrders = orders.map(sale => ({
        id: sale.id,
        orderNo: sale.orderNo || `#${sale.id}`,
        tableNo: sale.tableNo || '?',
        waiterName: sale.waiterName || 'Server',
        time: sale.time || (sale.date ? new Date(sale.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'),
        items: (sale.items || []).map((item: any) => ({
            name: productDetailsToName(item),
            quantity: item.quantity,
            status: item.status || 'Pending',
            target: item.target || determineTarget(item) // Use existing target if available
        })),
        rawSale: sale
    })).filter(o => o.items.length > 0);

    // Mock helpers for migration (can be refined)
    function productDetailsToName(item: any) {
        return item.product_name || item.name || 'Unknown Item';
    }

    function determineTarget(item: any) {
        // Simple heuristic: Drinks -> Bar, Food -> Kitchen
        const name = (item.product_name || item.name || '').toLowerCase();
        if (['kopi', 'teh', 'jus', 'ice', 'panas', 'dingin', 'drink', 'minum'].some(k => name.includes(k))) return 'Bar';
        return 'Kitchen';
    }


    const handleUpdateItemStatus = (orderId: number, itemName: string, newStatus: string) => {
        // Find the sale and item
        // In real DB, we might update the sale_items table
        // For now, let's assume onUpdateStatus handles the logic
        onUpdateStatus(orderId, 'ItemUpdate', { itemName, newStatus });
    };

    const handleCompleteOrder = (orderId: number) => {
        if (confirm('Selesaikan seluruh pesanan ini?')) {
            onUpdateStatus(orderId, 'Served');
        }
    };

    const getFilteredOrders = (targetFilter: string) => {
        return kdsOrders.map(order => ({
            ...order,
            items: targetFilter === 'All' ? order.items : order.items.filter((i: any) => i.target === targetFilter)
        })).filter(order => order.items.length > 0);
    };

    const renderCard = (order: any) => (
        <div key={order.id} className="bg-white rounded-[32px] shadow-sm border border-gray-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 h-fit break-inside-avoid">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex justify-between items-start">
                <div className="space-y-1">
                    <div className="text-xs font-black text-primary uppercase tracking-widest">{order.orderNo}</div>
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-600" />
                        <span className="text-xl font-black text-gray-800">Meja {order.tableNo}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100">
                        <Clock className="w-3 h-3" />
                        {order.time}
                    </div>
                    <div className={`text-[10px] font-bold ${parseInt(getElapsedTime(order.rawSale?.date || '')) > 15 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                        {getElapsedTime(order.rawSale?.date || '')} lalu
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-center text-blue-600">
                        <User className="w-3 h-3" />
                        {order.waiterName}
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 space-y-4">
                {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${item.status === 'Ready' ? 'bg-green-100 text-green-600' :
                                    item.status === 'Preparing' ? 'bg-orange-100 text-orange-600 animate-pulse' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                    {item.quantity}
                                </div>
                                <span className={`font-bold text-sm ${item.status === 'Ready' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                    {item.name}
                                </span>
                            </div>
                            {item.status !== 'Ready' && (
                                <button
                                    onClick={() => handleUpdateItemStatus(order.id, item.name, 'Ready')}
                                    className="p-2 bg-gray-50 hover:bg-green-50 text-gray-300 hover:text-green-600 rounded-lg transition-colors"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
                <Button onClick={() => handleCompleteOrder(order.id)} disabled={!order.items.every((i: any) => i.status === 'Ready')} className={`w-full h-12 rounded-2xl font-black gap-2 ${order.items.every((i: any) => i.status === 'Ready') ? 'bg-gray-900 hover:bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {order.items.every((i: any) => i.status === 'Ready') ? <><CheckCircle2 className="w-5 h-5" /> Siap Sajikan</> : <><Clock className="w-5 h-5" /> Diproses</>}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight">Monitor Pesanan</h2>
                    <p className="text-sm text-gray-500 font-medium">
                        {isSplitView ? 'Mode Split View (Dapur & Bar)' : `Tampilan: ${filter === 'All' ? 'Semua' : filter}`}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSplitView(!isSplitView)}
                        className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${isSplitView ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'}`}
                    >
                        {isSplitView ? 'Mode Tab' : 'Mode Pisah (Split)'}
                    </button>

                    {!isSplitView && (
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                            {[
                                { id: 'All', label: 'Semua', icon: ChefHat },
                                { id: 'Kitchen', label: 'Dapur', icon: ChefHat },
                                { id: 'Bar', label: 'Bar', icon: Coffee }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id as any)}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${filter === tab.id
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-gray-200'
                                        : 'text-gray-500 hover:bg-white/50'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            {isSplitView ? (
                <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200 overflow-hidden">
                    {/* Kitchen Column */}
                    <div className="flex-1 flex flex-col bg-orange-50/30 min-w-[300px]">
                        <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                            <div className="font-black text-orange-700 flex items-center gap-2"><ChefHat className="w-5 h-5" /> Dapur</div>
                            <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{getFilteredOrders('Kitchen').length}</span>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                                {getFilteredOrders('Kitchen').map(order => renderCard(order))}
                            </div>
                        </div>
                    </div>
                    {/* Bar Column */}
                    <div className="flex-1 flex flex-col bg-blue-50/30 min-w-[300px]">
                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                            <div className="font-black text-blue-700 flex items-center gap-2"><Coffee className="w-5 h-5" /> Bar</div>
                            <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{getFilteredOrders('Bar').length}</span>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                                {getFilteredOrders('Bar').map(order => renderCard(order))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 p-8 overflow-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {getFilteredOrders(filter).map(order => renderCard(order))}
                    </div>
                    {getFilteredOrders(filter).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <ChefHat className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-400">Tidak ada pesanan aktif</h3>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
