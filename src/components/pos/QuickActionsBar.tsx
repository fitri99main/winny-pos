import { Percent, Split, Pause, CreditCard, PackagePlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface QuickActionsBarProps {
  onManualItemClick: () => void;
  onDiscountClick: () => void;
  onSplitBillClick: () => void;
  onHoldOrderClick: () => void;
  onHeldOrdersClick: () => void;
  onPaymentClick: () => void;
  hasItems: boolean;
  heldCount: number;
}

export function QuickActionsBar({
  onManualItemClick,
  onDiscountClick,
  onSplitBillClick,
  onHoldOrderClick,
  onHeldOrdersClick,
  onPaymentClick,
  hasItems,
  heldCount,
}: QuickActionsBarProps) {

  const handleAction = (action: () => void, label: string) => {
    if (!hasItems) {
      toast.warning(`Keranjang kosong. Tambahkan item sebelum ${label}.`);
      return;
    }
    action();
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-2xl p-4 flex gap-3"
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onManualItemClick}
            className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <PackagePlus className="w-5 h-5 text-pos-charcoal" />
            <span className="font-medium text-pos-charcoal">Item Manual</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction(onDiscountClick, 'memberi diskon')}
            // We removed disabled prop to allow feedback
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl transition-colors ${!hasItems ? 'bg-gray-50 text-gray-400' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'
              }`}
          >
            <Percent className={`w-5 h-5 ${!hasItems ? 'text-gray-400' : 'text-pos-charcoal'}`} />
            <span className="font-medium">Diskon</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction(onSplitBillClick, 'memisah tagihan')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl transition-colors ${!hasItems ? 'bg-gray-50 text-gray-400' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'
              }`}
          >
            <Split className={`w-5 h-5 ${!hasItems ? 'text-gray-400' : 'text-pos-charcoal'}`} />
            <span className="font-medium">Pisah Tagihan</span>
          </motion.button>

          <div className="flex-1 flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAction(onHoldOrderClick, 'menangguhkan pesanan')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl transition-colors ${!hasItems ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-pos-charcoal'
                }`}
            >
              <Pause className={`w-5 h-5 ${!hasItems ? 'text-gray-400' : 'text-pos-charcoal'}`} />
              <span className="font-medium">Tangguhkan</span>
            </motion.button>

            {heldCount > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onHeldOrdersClick}
                className="w-16 flex items-center justify-center rounded-xl bg-pos-teal/10 text-pos-teal border border-pos-teal/20 relative"
              >
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-pos-teal rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  {heldCount}
                </div>
                <Pause className="w-5 h-5" />
              </motion.button>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction(onPaymentClick, 'melakukan pembayaran')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl transition-colors shadow-lg ${!hasItems ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-pos-coral hover:bg-orange-600 text-white'
              }`}
          >
            <CreditCard className={`w-5 h-5 ${!hasItems ? 'text-gray-500' : 'text-white'}`} />
            <span className="font-bold">Pembayaran</span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
