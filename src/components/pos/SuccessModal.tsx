import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Printer, Mail, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

interface SuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  change?: number;
  onNewTransaction: () => void;
  onViewHistory?: () => void;
}

export function SuccessModal({
  open,
  onOpenChange,
  total,
  change,
  onNewTransaction,
  onViewHistory,
}: SuccessModalProps) {
  const [showReceipt, setShowReceipt] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  useEffect(() => {
    if (open) {
      // Trigger confetti
      const duration = 1500;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FF6B35', '#4ECDC4', '#F8F6F3'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FF6B35', '#4ECDC4', '#F8F6F3'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      setTimeout(() => setShowReceipt(true), 800);
    } else {
      setShowReceipt(false);
    }
  }, [open]);

  const handleNewTransaction = () => {
    onOpenChange(false);
    onNewTransaction();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogDescription className="sr-only">
          Pembayaran berhasil dan opsi struk.
        </DialogDescription>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center py-6"
        >
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            className="w-24 h-24 mx-auto mb-6 relative"
          >
            <div className="absolute inset-0 bg-pos-teal/20 rounded-full animate-ping duration-1000" />
            <div className="relative bg-gradient-to-tr from-pos-teal to-emerald-400 w-full h-full rounded-full flex items-center justify-center shadow-lg shadow-pos-teal/30">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
          </motion.div>

          <h2 className="text-3xl font-black text-gray-800 mb-2 tracking-tight">
            Pembayaran Berhasil!
          </h2>
          <p className="text-gray-500 font-medium mb-8">
            Transaksi telah selesai dan tercatat di sistem
          </p>

          <div className="bg-gray-50/50 rounded-[32px] p-8 mb-8 border border-gray-100 shadow-inner">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Total Dibayar</span>
              <span className="text-2xl font-black text-gray-800 font-mono">
                {formatPrice(total)}
              </span>
            </div>
            {change !== undefined && change > 0 && (
              <div className="flex justify-between items-center pt-5 border-t border-gray-100">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Kembalian</span>
                <span className="text-2xl font-black text-pos-teal font-mono">
                  {formatPrice(change)}
                </span>
              </div>
            )}
          </div>

          {showReceipt && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.8 }}
              className="space-y-4 mb-8"
            >
              <div className="flex items-center gap-2 mb-4 justify-center">
                <div className="h-px w-8 bg-gray-200" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pilih Opsi Struk</span>
                <div className="h-px w-8 bg-gray-200" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-16 rounded-2xl flex flex-col gap-1 transition-all border-gray-100 hover:border-pos-teal hover:bg-pos-teal/5 group"
                  onClick={() => toast.success('Struk sedang dicetak...')}
                >
                  <Printer className="w-5 h-5 text-gray-400 group-hover:text-pos-teal" />
                  <span className="text-[10px] font-black">CETAK</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-16 rounded-2xl flex flex-col gap-1 transition-all border-gray-100 hover:border-blue-400 hover:bg-blue-50 group"
                  onClick={() => toast.success('Struk berhasil dikirim ke Email')}
                >
                  <Mail className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                  <span className="text-[10px] font-black">EMAIL</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-16 rounded-2xl flex flex-col gap-1 transition-all border-gray-100 hover:border-green-400 hover:bg-green-50 group"
                  onClick={() => toast.success('Struk berhasil dikirim ke WhatsApp')}
                >
                  <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-green-500" />
                  <span className="text-[10px] font-black">WHATSAPP</span>
                </Button>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleNewTransaction}
              className="w-full h-16 rounded-[24px] text-lg font-black bg-pos-coral hover:bg-orange-600 shadow-xl shadow-pos-coral/20 transition-all active:scale-[0.98]"
            >
              Transaksi Baru
            </Button>

            {onViewHistory && (
              <Button
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                  onViewHistory();
                }}
                className="w-full h-12 rounded-xl text-gray-400 hover:text-pos-coral font-bold transition-colors"
              >
                Ke Riwayat Penjualan
              </Button>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
