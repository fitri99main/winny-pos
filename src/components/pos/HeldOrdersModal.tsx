import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pause, Play, Trash2, Clock, Store } from 'lucide-react';
import { OrderItem } from '@/types/pos';

interface HeldOrder {
    id: string;
    orderNo?: string;
    items: OrderItem[];
    discount: number;
    total: number;
    createdAt: Date;
    tableNo?: string;
    customerName?: string;
    isRemote?: boolean;
}

interface HeldOrdersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    heldOrders: HeldOrder[];
    onRestore: (order: HeldOrder) => void;
    onDelete?: (id: string) => void;
}

export function HeldOrdersModal({
    open,
    onOpenChange,
    heldOrders,
    onRestore,
    onDelete,
}: HeldOrdersModalProps) {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Pause className="w-6 h-6 text-pos-coral" />
                        Pesanan Ditangguhkan
                    </DialogTitle>
                    <DialogDescription>
                        Daftar pesanan yang sedang ditangguhkan. Pilih untuk melanjutkan atau hapus.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    {heldOrders.length === 0 ? (
                        <div className="py-20 text-center text-gray-400">
                            <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Tidak ada pesanan yang ditangguhkan saat ini</p>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4">
                            {heldOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-gray-50 rounded-2xl p-5 border border-gray-100 group hover:border-pos-coral/30 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-pos-charcoal">
                                                    #{order.orderNo || order.id.split('-')[1]}
                                                </h4>
                                                {order.isRemote ? (
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100 flex items-center gap-1">
                                                        <Store className="w-3 h-3" />
                                                        CLOUD
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full border border-gray-200">
                                                        LOKAL
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {order.createdAt.toLocaleTimeString('id-ID', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })} • {order.items.length} item • {order.tableNo || 'Takeaway'}
                                            </p>
                                            {order.customerName && (
                                                <p className="text-[10px] text-pos-coral font-bold uppercase mt-1">
                                                    Cust: {order.customerName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-pos-charcoal text-lg">
                                                {formatPrice(order.total)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-4">
                                        <Button
                                            onClick={() => onRestore(order)}
                                            className="flex-1 bg-pos-teal hover:bg-teal-600 text-white gap-2 h-11"
                                        >
                                            <Play className="w-4 h-4" />
                                            Kembalikan Pesanan
                                        </Button>
                                        {onDelete && (
                                            <Button
                                                variant="outline"
                                                onClick={() => onDelete(order.id)}
                                                className="w-11 h-11 border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl flex-shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
