import { useState } from 'react';
import { ChefHat, Coffee, CheckCircle2, Clock, MapPin, User, ChevronRight, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface KDSItem {
    name: string;
    quantity: number;
    target: 'Kitchen' | 'Bar' | 'Waitress';
    status: 'Pending' | 'Preparing' | 'Ready' | 'Served';
}

interface KDSOrder {
    id: number;
    orderNo: string;
    tableNo: string;
    waiterName: string;
    time: string;
    items: KDSItem[];
}

interface KDSViewProps {
    pendingOrders: KDSOrder[];
    setPendingOrders: React.Dispatch<React.SetStateAction<KDSOrder[]>>;
}

export function KDSView({ pendingOrders, setPendingOrders }: KDSViewProps) {
    const [filter, setFilter] = useState<'All' | 'Kitchen' | 'Bar'>('All');

    const handleUpdateItemStatus = (orderId: number, itemName: string, newStatus: KDSItem['status']) => {
        setPendingOrders(prev => prev.map(order => {
            if (order.id === orderId) {
                return {
                    ...order,
                    items: order.items.map(item =>
                        item.name === itemName ? { ...item, status: newStatus } : item
                    )
                };
            }
            return order;
        }));

        if (newStatus === 'Ready') {
            toast.success(`${itemName} siap disajikan!`);
        }
    };

    const handleCompleteOrder = (orderId: number) => {
        // Only remove if all filtered items are ready
        if (confirm('Selesaikan seluruh pesanan ini?')) {
            setPendingOrders(prev => prev.filter(o => o.id !== orderId));
            toast.success('Pesanan diselesaikan');
        }
    };

    const filteredOrders = pendingOrders.map(order => ({
        ...order,
        items: filter === 'All' ? order.items : order.items.filter(i => i.target === filter)
    })).filter(order => order.items.length > 0);

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight">Monitor Pesanan</h2>
                    <p className="text-sm text-gray-500 font-medium">KDS (Kitchen Display System) - Real-time Queue</p>
                </div>

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
            </div>

            {/* Grid */}
            <div className="flex-1 p-8 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredOrders.map(order => (
                        <div key={order.id} className="bg-white rounded-[32px] shadow-sm border border-gray-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Card Header */}
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
                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600">
                                        <User className="w-3 h-3" />
                                        {order.waiterName}
                                    </div>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="flex-1 p-6 space-y-4">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${item.status === 'Ready' ? 'bg-green-100 text-green-600' :
                                                        item.status === 'Preparing' ? 'bg-orange-100 text-orange-600 animate-pulse' :
                                                            'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {item.quantity}
                                                </div>
                                                <span className={`font-black text-sm tracking-tight ${item.status === 'Ready' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                    {item.name}
                                                </span>
                                            </div>

                                            <div className="flex gap-1">
                                                {item.status === 'Pending' && (
                                                    <button
                                                        onClick={() => handleUpdateItemStatus(order.id, item.name, 'Preparing')}
                                                        className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
                                                    >
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {item.status === 'Preparing' && (
                                                    <button
                                                        onClick={() => handleUpdateItemStatus(order.id, item.name, 'Ready')}
                                                        className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Card Footer */}
                            <div className="p-6 pt-0 mt-auto">
                                <Button
                                    onClick={() => handleCompleteOrder(order.id)}
                                    disabled={!order.items.every(i => i.status === 'Ready')}
                                    className={`w-full h-12 rounded-2xl font-black gap-2 ${order.items.every(i => i.status === 'Ready')
                                            ? 'bg-gray-900 hover:bg-black text-white'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {order.items.every(i => i.status === 'Ready') ? (
                                        <><CheckCircle2 className="w-5 h-5" /> Siap Sajikan</>
                                    ) : (
                                        <><Clock className="w-5 h-5" /> Sedang Diproses</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}

                    {filteredOrders.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-40 text-center">
                            <div className="w-24 h-24 bg-gray-100 rounded-[40px] flex items-center justify-center mb-6">
                                <ChefHat className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-black text-gray-400 tracking-tight">Tidak Ada Pesanan Aktif</h3>
                            <p className="text-sm text-gray-400 mt-2">Dapur dan Bar sedang santai sementara.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
