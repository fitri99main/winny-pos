import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Split, Minus, Plus } from 'lucide-react';
import { OrderItem } from '@/types/pos';

interface SplitBillModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: OrderItem[];
    onSplit: (selectedItems: OrderItem[]) => void;
}

export function SplitBillModal({
    open,
    onOpenChange,
    items,
    onSplit,
}: SplitBillModalProps) {
    // Store selected quantities for splitting
    const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const handleQuantityChange = (itemId: string, maxQty: number, change: number) => {
        const current = selectedQuantities[itemId] || 0;
        const next = Math.max(0, Math.min(maxQty, current + change));
        setSelectedQuantities({ ...selectedQuantities, [itemId]: next });
    };

    const splitItems = items
        .filter((item) => selectedQuantities[item.id] > 0)
        .map((item) => ({
            ...item,
            quantity: selectedQuantities[item.id],
        }));

    const splitTotal = splitItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
    );

    const handleSplitSubmit = () => {
        if (splitItems.length === 0) return;
        onSplit(splitItems);
        setSelectedQuantities({});
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Split className="w-6 h-6 text-pos-coral" />
                        Pisah Tagihan
                    </DialogTitle>
                    <p className="text-sm text-gray-500">
                        Pilih item yang ingin dibayar terpisah
                    </p>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-3 py-4">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex justify-between items-center"
                            >
                                <div className="flex-1">
                                    <h4 className="font-bold text-pos-charcoal text-sm">
                                        {item.product.name}
                                    </h4>
                                    <p className="text-xs text-gray-500">
                                        {formatPrice(item.product.price)} (Tersedia: {item.quantity})
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200">
                                        <button
                                            onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-md"
                                        >
                                            <Minus className="w-4 h-4 text-pos-charcoal" />
                                        </button>
                                        <span className="font-mono font-bold w-6 text-center text-sm">
                                            {selectedQuantities[item.id] || 0}
                                        </span>
                                        <button
                                            onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-md"
                                        >
                                            <Plus className="w-4 h-4 text-pos-charcoal" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="pt-4 border-t border-gray-200 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Terpisah:</span>
                        <span className="text-2xl font-mono font-bold text-pos-coral">
                            {formatPrice(splitTotal)}
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-12"
                        >
                            Batal
                        </Button>
                        <Button
                            disabled={splitTotal === 0}
                            onClick={handleSplitSubmit}
                            className="flex-1 h-12 bg-pos-teal hover:bg-teal-600"
                        >
                            Bayar Item Terpilih
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
