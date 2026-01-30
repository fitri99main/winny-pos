import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard, Smartphone, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { PaymentMethod } from '@/types/pos';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onPaymentComplete: (payment: {
    method: any;
    amount: number;
    change?: number;
    eWalletProvider?: string;
  }) => void;
  paymentMethods?: any[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  service?: number;
}

export function PaymentModal({
  open,
  onOpenChange,
  totalAmount,
  onPaymentComplete,
  paymentMethods = [],
  subtotal = 0,
  discount = 0,
  tax = 0,
  service = 0
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [eWalletProvider, setEWalletProvider] = useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const calculateChange = () => {
    const amount = parseFloat(cashAmount) || 0;
    return Math.max(0, amount - totalAmount);
  };

  const handlePayment = () => {
    if (!selectedMethod) return;

    if (selectedMethod.type === 'cash') {
      const amount = parseFloat(cashAmount) || 0;
      if (amount >= totalAmount) {
        onPaymentComplete({
          method: selectedMethod.name,
          amount,
          change: calculateChange(),
        });
      } else {
        toast.error(`Pembayaran kurang! Harap bayar minimal ${formatPrice(totalAmount)}`);
      }
    } else {
      onPaymentComplete({
        method: selectedMethod.name,
        amount: totalAmount,
      });
    }
  };

  const handlePaymentWithLog = () => {
    try {
      handlePayment();
    } catch (e: any) {
      console.error("Payment error:", e);
      toast.error("Error confirming payment: " + e.message);
    }
  };

  const quickAmounts = Array.from(new Set([
    totalAmount,
    Math.ceil(totalAmount / 50000) * 50000,
    Math.ceil(totalAmount / 100000) * 100000,
  ])).filter(amount => amount > 0);

  useEffect(() => {
    if (!open) {
      setSelectedMethod(null);
      setCashAmount('');
      setEWalletProvider('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold">Pembayaran</DialogTitle>
          <DialogDescription>
            Pilih metode pembayaran untuk menyelesaikan transaksi sebesar {formatPrice(totalAmount)}.
          </DialogDescription>
          <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-2 border-2 border-red-500">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-sm text-red-500">
                <span>Diskon</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm text-gray-500">
              <span>Pajak ({tax > 0 ? formatPrice(tax) : '0'})</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Layanan ({service > 0 ? formatPrice(service) : '0'})</span>
              <span>{formatPrice(service)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
              <p className="text-sm font-bold text-gray-700">Total Tagihan</p>
              <p className="text-2xl font-mono font-bold text-pos-coral">
                {formatPrice(totalAmount)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Method Selection */}
          {!selectedMethod && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {paymentMethods.filter(m => m.is_active).map((method) => (
                <motion.button
                  key={method.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (method.type === 'cash') {
                      setSelectedMethod(method);
                    } else {
                      setSelectedMethod(method);
                    }
                  }}
                  className="p-6 border-2 border-gray-200 rounded-2xl hover:border-pos-coral hover:bg-orange-50 transition-all flex flex-col items-center justify-center gap-3"
                >
                  {method.type === 'cash' ? (
                    <Banknote className="w-10 h-10 text-pos-coral" />
                  ) : method.type === 'card' ? (
                    <CreditCard className="w-10 h-10 text-pos-coral" />
                  ) : (
                    <Smartphone className="w-10 h-10 text-pos-coral" />
                  )}
                  <p className="font-bold text-pos-charcoal text-center leading-tight">{method.name}</p>
                </motion.button>
              ))}
            </div>
          )}

          {/* Cash Payment */}
          {selectedMethod?.type === 'cash' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="text-base">Jumlah Tunai</Label>
                <Input
                  type="number"
                  placeholder="Masukkan jumlah tunai"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="h-14 text-xl font-mono"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {quickAmounts.map((amount, idx) => (
                  <Button
                    key={`${amount}-${idx}`}
                    variant="outline"
                    onClick={() => setCashAmount(amount.toString())}
                    className="h-12"
                  >
                    {formatPrice(amount)}
                  </Button>
                ))}
              </div>

              {cashAmount && parseFloat(cashAmount) >= totalAmount && (
                <div className="p-4 bg-pos-teal/10 border border-pos-teal rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Kembalian</p>
                  <p className="text-2xl font-mono font-bold text-pos-teal">
                    {formatPrice(calculateChange())}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMethod(null)}
                  className="flex-1 h-12"
                >
                  Back
                </Button>
                <Button
                  onClick={handlePaymentWithLog}
                  // We removed disabled to allow clicking and showing the error toast if amount is low
                  className="flex-1 h-12 bg-pos-coral hover:bg-orange-600"
                >
                  Selesaikan Pembayaran
                </Button>
              </div>
            </motion.div>
          )}

          {/* Non-Cash Payment Confirmation */}
          {selectedMethod && selectedMethod.type !== 'cash' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="p-6 bg-gray-50 rounded-xl text-center">
                {selectedMethod.type === 'card' ? (
                  <CreditCard className="w-16 h-16 mx-auto mb-4 text-pos-coral animate-pulse" />
                ) : (
                  <Smartphone className="w-16 h-16 mx-auto mb-4 text-pos-coral animate-pulse" />
                )}
                <p className="text-lg font-medium text-pos-charcoal mb-2">
                  Konfirmasi Pembayaran {selectedMethod.name}
                </p>
                <p className="text-sm text-gray-600">
                  Pastikan pembayaran telah {selectedMethod.type === 'card' ? 'berhasil diproses di mesin EDC' : 'diterima'} sebelum konfirmasi.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMethod(null)}
                  className="flex-1 h-12"
                >
                  Batal
                </Button>
                <Button
                  onClick={handlePayment}
                  className="flex-1 h-12 bg-pos-coral hover:bg-orange-600"
                >
                  Konfirmasi Pembayaran
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
