import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: number;
  tableNo?: string;
  itemsCount: number;
  onConfirm: () => void;
}

export function NewOrderModal({
  open,
  onOpenChange,
  orderId,
  tableNo,
  itemsCount,
  onConfirm
}: NewOrderModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Pesanan Baru Diterima</DialogTitle>
          <DialogDescription className="sr-only">Konfirmasi pesanan baru sebelum memproses pembayaran.</DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center py-6"
        >
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-blue-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Pesanan Baru Diterima!
          </h2>
          
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            {tableNo && (
              <p className="text-gray-600 mb-1">
                Meja: <strong className="text-gray-900">{tableNo}</strong>
              </p>
            )}
            <p className="text-gray-600">
              Jumlah Item: <strong className="text-gray-900">{itemsCount} Item</strong>
            </p>
          </div>

          <Button 
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Lanjut ke Pembayaran
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
