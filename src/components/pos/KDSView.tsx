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
    const kdsOrders = (orders || []).filter(Boolean).map(sale => ({
        id: sale.id,
        orderNo: sale.orderNo || `#${sale.id}`,
        tableNo: sale.tableNo || '?',
        waiterName: sale.waiterName || 'Server',
        time: sale.time || (sale.date ? new Date(sale.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'),
        items: (sale.productDetails || []).map((item: any) => ({
            name: productDetailsToName(item),
            quantity: item.quantity,
            status: item.status || 'Pending',
            target: item.target || determineTarget(item), // Use existing target if available
            notes: item.notes
        })),
        rawSale: sale
    })).filter(o => o.items && o.items.length > 0);

    // Mock helpers for migration (can be refined)
    function productDetailsToName(item: any) {
        return item.product_name || item.name || 'Unknown Item';
    }

    function determineTarget(item: any) {
        // Robust Heuristic v3: Drinks -> Bar, Food -> Kitchen
        const nameLow = (item.product_name || item.name || '').toLowerCase();
        const categoryLow = (item.category || '').toLowerCase();

        const isDrink = [
            'minum', 'drink', 'beverage', 'juice', 'jus', 'tea', 'teh', 'coffee', 'kopi', 
            'susu', 'milk', 'water', 'air', 'mineral', 'soda', 'cola', 'coke', 'sprite', 'fanta',
            'beer', 'bir', 'wine', 'cocktail', 'mocktail', 'smoothie', 'shake', 'milo', 
            'boba', 'thai tea', 'green tea', 'lemongrass', 'jeruk', 'lemon', 'alpukat', 'mangga', 
            'strawberry', 'jahe', 'madu', 'sirup', 'cendol', 'dawet', 'wedang', 'gembira', 'arak',
            'espresso', 'latte', 'cappuccino', 'frappe'
        ].some(k => categoryLow.includes(k) || nameLow.includes(k)) || 
        nameLow.startsWith('es ') || nameLow.startsWith('ice ') || 
        nameLow.includes(' es ') || nameLow.includes(' ice ') ||
        nameLow.includes(' panas') || nameLow.includes(' hot') || 
        nameLow.includes(' dingin') || nameLow.includes(' cold');

        return isDrink ? 'Bar' : 'Kitchen';
    }


    const handleUpdateItemStatus = (orderId: number, itemName: string, newStatus: string) => {
        // Find the sale and item
        // In real DB, we might update the sale_items table
        // For now, let's assume onUpdateStatus handles the logic
        onUpdateStatus(orderId, 'ItemUpdate', { itemName, newStatus });
    };

    const handleCompleteOrder = (orderId: number) => {
        if (confirm('Selesaikan seluruh pesanan ini?')) {
            onUpdateStatus(orderId, 'Served', { filter });
        }
    };

    const getFilteredOrders = (targetFilter: string) => {
        return kdsOrders.map(order => ({
            ...order,
            items: (targetFilter === 'All' ? (order.items || []) : (order.items || []).filter((i: any) => i.target === targetFilter)).filter((i: any) => i && i.status !== 'Served')
        })).filter(order => order.items && order.items.length > 0);
    };

    const renderCard = (order: any) => (
        <div key={order.id} className="bg-white rounded-2xl sm:rounded-[32px] shadow-sm border border-gray-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 h-fit break-inside-avoid">
            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/30 flex justify-between items-start">
                <div className="space-y-0.5 sm:space-y-1">
                    <div className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-widest">{order.orderNo}</div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
                        <span className="text-base sm:text-xl font-black text-gray-800">Meja {order.tableNo}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-black text-gray-400 bg-white px-2 py-0.5 sm:py-1 rounded-lg border border-gray-100">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {order.time}
                    </div>
                    <div className={`text-[9px] sm:text-[10px] font-bold ${parseInt(getElapsedTime(order.rawSale?.date || '')) > 15 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                        {getElapsedTime(order.rawSale?.date || '')} lalu
                    </div>
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-center text-blue-600">
                        <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {order.waiterName}
                    </div>
                </div>
            </div>

            <div className="flex-1 p-3.5 sm:p-6 space-y-3 sm:space-y-4">
                {(order.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0 ${item.status === 'Ready' ? 'bg-green-100 text-green-600' :
                                    item.status === 'Preparing' ? 'bg-orange-100 text-orange-600 animate-pulse' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                    {item.quantity}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`font-bold text-xs sm:text-sm ${item.status === 'Ready' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                        {item.name}
                                    </span>
                                    {item.notes && (
                                        <span className="text-[9px] sm:text-[10px] text-orange-600 font-medium italic">
                                            Catatan: {item.notes}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {item.status !== 'Ready' && (
                                <button
                                    onClick={() => handleUpdateItemStatus(order.id, item.name, item.status === 'Preparing' ? 'Ready' : 'Preparing')}
                                    className={`p-2 rounded-lg transition-all duration-200 active:scale-95 ${item.status === 'Preparing' ? 'bg-orange-100 hover:bg-green-50 text-orange-600 hover:text-green-600 animate-pulse' : 'bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-orange-600'}`}
                                    title={item.status === 'Preparing' ? 'Selesaikan menu' : 'Mulai proses menu'}
                                >
                                    {item.status === 'Preparing' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100">
                <Button onClick={() => handleCompleteOrder(order.id)} disabled={!(order.items || []).every((i: any) => i && i.status === 'Ready')} className={`w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl font-black gap-2 text-xs sm:text-sm ${(order.items || []).every((i: any) => i && i.status === 'Ready') ? 'bg-gray-900 hover:bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {(order.items || []).every((i: any) => i && i.status === 'Ready') ? <><CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> Siap Sajikan</> : <><Clock className="w-4 h-4 sm:w-5 sm:h-5" /> Diproses</>}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 md:px-8 sm:py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-800 tracking-tight">Monitor Pesanan</h2>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium">
                        {isSplitView ? 'Mode Split View (Dapur & Bar)' : `Tampilan: ${filter === 'All' ? 'Semua' : filter}`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setIsSplitView(!isSplitView)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-black border transition-all ${isSplitView ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'}`}
                    >
                        {isSplitView ? 'Mode Tab' : 'Mode Pisah'}
                    </button>

                    {!isSplitView && (
                        <div className="flex gap-1 sm:gap-2 p-1 bg-gray-100 rounded-xl sm:rounded-2xl">
                            {[
                                { id: 'All', label: 'Semua', icon: ChefHat },
                                { id: 'Kitchen', label: 'Dapur', icon: ChefHat },
                                { id: 'Bar', label: 'Bar', icon: Coffee }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id as any)}
                                    className={`flex items-center gap-1.5 px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all ${filter === tab.id
                                        ? 'bg-white text-primary shadow-sm ring-1 ring-gray-200'
                                        : 'text-gray-500 hover:bg-white/50'
                                        }`}
                                >
                                    <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                    <div className="flex-1 flex flex-col bg-orange-50/30 min-w-0">
                        <div className="p-3 sm:p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                            <div className="font-black text-orange-700 flex items-center gap-2 text-xs sm:text-sm"><ChefHat className="w-4 h-4 sm:w-5 sm:h-5" /> Dapur</div>
                            <span className="text-[10px] sm:text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{getFilteredOrders('Kitchen').length}</span>
                        </div>
                        <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-6 w-full">
                                {getFilteredOrders('Kitchen').map(order => renderCard(order))}
                            </div>
                        </div>
                    </div>
                    {/* Bar Column */}
                    <div className="flex-1 flex flex-col bg-blue-50/30 min-w-0">
                        <div className="p-3 sm:p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                            <div className="font-black text-blue-700 flex items-center gap-2 text-xs sm:text-sm"><Coffee className="w-4 h-4 sm:w-5 sm:h-5" /> Bar</div>
                            <span className="text-[10px] sm:text-xs font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{getFilteredOrders('Bar').length}</span>
                        </div>
                        <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-6 w-full">
                                {getFilteredOrders('Bar').map(order => renderCard(order))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 p-3 sm:p-6 md:p-8 overflow-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                        {getFilteredOrders(filter).map(order => renderCard(order))}
                    </div>
                    {getFilteredOrders(filter).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <ChefHat className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300" />
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-400">Tidak ada pesanan aktif</h3>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
