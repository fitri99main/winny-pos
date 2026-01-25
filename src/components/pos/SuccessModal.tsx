import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center py-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <CheckCircle2 className="w-24 h-24 mx-auto mb-6 text-pos-teal" />
          </motion.div>

          <h2 className="text-3xl font-bold text-pos-charcoal mb-2">
            Pembayaran Berhasil!
          </h2>
          <p className="text-gray-600 mb-6">
            Transaksi telah selesai dengan sukses
          </p>

          <div className="bg-gray-50 rounded-xl p-6 mb-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Dibayar</span>
              <span className="font-mono font-bold text-pos-charcoal">
                {formatPrice(total)}
              </span>
            </div>
            {change !== undefined && change > 0 && (
              <div className="flex justify-between pt-3 border-t border-gray-200">
                <span className="text-gray-600">Kembalian</span>
                <span className="font-mono font-bold text-pos-teal">
                  {formatPrice(change)}
                </span>
              </div>
            )}
          </div>

          {showReceipt && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 mb-6"
            >
              <p className="text-sm text-gray-600 mb-3">Kirim Struk</p>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-14 flex flex-col gap-1 hover:bg-pos-teal/5 hover:text-pos-teal hover:border-pos-teal/30"
                  onClick={() => toast.success('Struk sedang dicetak...')}
                >
                  <Printer className="w-5 h-5" />
                  <span className="text-xs">Cetak</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-14 flex flex-col gap-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                  onClick={() => toast.success('Struk berhasil dikirim ke Email')}
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-xs">Email</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-14 flex flex-col gap-1 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                  onClick={() => toast.success('Struk berhasil dikirim ke WhatsApp')}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs">WhatsApp</span>
                </Button>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleNewTransaction}
              className="w-full h-14 text-lg bg-pos-coral hover:bg-orange-600"
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
                className="w-full h-12 text-gray-500 hover:text-pos-coral font-medium"
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
