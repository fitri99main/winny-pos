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

  const buttonBaseClass = "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95";

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100/50 p-2 flex gap-2"
        >
          <button
            onClick={onManualItemClick}
            className={`${buttonBaseClass} bg-gray-50 hover:bg-gray-100 text-pos-charcoal`}
          >
            <PackagePlus className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Item Manual</span>
          </button>

          <button
            onClick={() => handleAction(onDiscountClick, 'memberi diskon')}
            className={`${buttonBaseClass} ${!hasItems ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'}`}
          >
            <Percent className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Diskon</span>
          </button>

          <button
            onClick={() => handleAction(onSplitBillClick, 'memisah tagihan')}
            className={`${buttonBaseClass} ${!hasItems ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'}`}
          >
            <Split className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Pisah Bill</span>
          </button>

          <div className="flex-1 flex gap-2">
            <button
              onClick={() => handleAction(onHoldOrderClick, 'menangguhkan pesanan')}
              className={`${buttonBaseClass} ${!hasItems ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'}`}
            >
              <Pause className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Tahan</span>
            </button>

            {heldCount > 0 && (
              <button
                onClick={onHeldOrdersClick}
                className="w-14 flex flex-col items-center justify-center gap-1 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 active:scale-95 transition-transform"
              >
                <div className="bg-teal-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {heldCount}
                </div>
                <span className="text-[9px] font-bold">List</span>
              </button>
            )}
          </div>

          <button
            onClick={() => handleAction(onPaymentClick, 'melakukan pembayaran')}
            className={`${buttonBaseClass} flex-[1.5] shadow-lg ${!hasItems ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'}`}
          >
            <CreditCard className="w-6 h-6" />
            <span className="text-xs font-black uppercase tracking-wider">Pembayaran</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
