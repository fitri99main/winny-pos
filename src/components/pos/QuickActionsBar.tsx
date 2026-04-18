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
  embedded?: boolean;
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
  embedded = false,
}: QuickActionsBarProps) {

  const handleAction = (action: () => void, label: string) => {
    if (!hasItems) {
      toast.warning(`Keranjang kosong. Tambahkan item sebelum ${label}.`);
      return;
    }
    action();
  };

  const buttonBaseClass = embedded
    ? "flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95 min-h-16"
    : "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95";

  return (
    <div className={embedded ? "w-full" : "absolute bottom-4 left-4 right-4 z-50"}>
      <div className={embedded ? "w-full" : "max-w-5xl mx-auto"}>
        <motion.div
          initial={{ y: embedded ? 0 : 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={embedded
            ? "bg-white/95 backdrop-blur-md rounded-3xl shadow-lg border border-gray-100/80 p-3 space-y-3"
            : "bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100/50 p-2 flex gap-2"
          }
        >
          {embedded && (
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Aksi Cepat</p>
                <p className="text-xs font-semibold text-gray-500">{hasItems ? 'Keranjang siap diproses' : 'Tambahkan produk ke keranjang'}</p>
              </div>
              {heldCount > 0 && (
                <button
                  onClick={onHeldOrdersClick}
                  className="flex items-center gap-2 rounded-2xl bg-teal-50 px-3 py-2 text-teal-700 border border-teal-100"
                >
                  <div className="bg-teal-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {heldCount}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wide">Daftar</span>
                </button>
              )}
            </div>
          )}

          <div className={embedded ? "grid grid-cols-2 gap-2" : "flex gap-2 flex-1"}>
            <button
              onClick={onManualItemClick}
              className={`${buttonBaseClass} bg-gray-50 hover:bg-gray-100 text-pos-charcoal ${embedded ? '' : 'flex-1'}`}
            >
              <PackagePlus className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Item Manual</span>
            </button>

            <button
              onClick={() => handleAction(onDiscountClick, 'memberi diskon')}
              className={`${buttonBaseClass} ${!hasItems ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'} ${embedded ? '' : 'flex-1'}`}
            >
              <Percent className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Diskon</span>
            </button>

            <button
              onClick={() => handleAction(onSplitBillClick, 'memisah tagihan')}
              className={`${buttonBaseClass} ${!hasItems ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'} ${embedded ? '' : 'flex-1'}`}
            >
              <Split className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Pisah Bill</span>
            </button>

            <button
              onClick={() => handleAction(onHoldOrderClick, 'menangguhkan pesanan')}
              className={`${buttonBaseClass} ${!hasItems ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 hover:bg-gray-100 text-pos-charcoal'} ${embedded ? '' : 'flex-1'}`}
            >
              <Pause className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Tahan</span>
            </button>
          </div>

          <button
            onClick={() => handleAction(onPaymentClick, 'melakukan pembayaran')}
            className={`${buttonBaseClass} w-full shadow-lg ${!hasItems ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200'}`}
          >
            <CreditCard className="w-6 h-6" />
            <span className="text-xs font-black uppercase tracking-wider">Pembayaran</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
