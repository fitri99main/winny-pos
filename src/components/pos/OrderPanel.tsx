import { OrderItem } from '@/types/pos';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderPanelProps {
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  onQuantityChange: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export function OrderPanel({
  items,
  subtotal,
  discount,
  total,
  onQuantityChange,
  onRemoveItem,
}: OrderPanelProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="h-full flex flex-col frosted-glass rounded-3xl border border-white/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50">
        <h2 className="text-2xl font-bold text-pos-charcoal">Pesanan Saat Ini</h2>
        <p className="text-sm text-gray-500 mt-1">
          {items.length} {items.length === 1 ? 'item' : 'item'}
        </p>
      </div>

      {/* Items List */}
      <ScrollArea className="flex-1 px-6">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full py-20 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <span className="text-3xl">🛒</span>
              </div>
              <p className="text-gray-400 font-medium">Belum ada item</p>
              <p className="text-sm text-gray-400 mt-1">
                Mulai tambahkan produk
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3 py-4">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="bg-white rounded-2xl p-4 shadow-sm group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 pr-2">
                      <h4 className="font-medium text-pos-charcoal text-sm mb-0.5">
                        {item.product.name}
                      </h4>
                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {item.selectedAddons.map((addon) => (
                            <span key={addon.id} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-md font-medium">
                              +{addon.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatPrice(item.product.price + (item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0))} × {item.quantity}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                      <button
                        onClick={() =>
                          onQuantityChange(item.id, Math.max(1, item.quantity - 1))
                        }
                        className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                      >
                        <Minus className="w-4 h-4 text-pos-charcoal" />
                      </button>
                      <span className="font-mono font-semibold text-pos-charcoal w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                      >
                        <Plus className="w-4 h-4 text-pos-charcoal" />
                      </button>
                    </div>

                    <p className="font-mono font-semibold text-pos-charcoal">
                      {formatPrice((item.product.price + (item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0)) * item.quantity)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Totals */}
      {items.length > 0 && (
        <div className="p-6 border-t border-gray-200/50 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-mono font-medium text-pos-charcoal">
              {formatPrice(subtotal)}
            </span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Diskon</span>
              <span className="font-mono font-medium text-red-500">
                -{formatPrice(discount)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-3 border-t border-gray-200/50">
            <span className="text-lg font-bold text-pos-charcoal">Total</span>
            <span className="font-mono font-bold text-2xl text-pos-coral">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
