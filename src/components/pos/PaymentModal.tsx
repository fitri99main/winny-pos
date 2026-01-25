import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard, Smartphone, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { PaymentMethod } from '@/types/pos';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onPaymentComplete: (payment: {
    method: PaymentMethod;
    amount: number;
    change?: number;
    eWalletProvider?: string;
  }) => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  totalAmount,
  onPaymentComplete,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
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

    if (selectedMethod === 'cash') {
      const amount = parseFloat(cashAmount) || 0;
      if (amount >= totalAmount) {
        onPaymentComplete({
          method: 'cash',
          amount,
          change: calculateChange(),
        });
      }
    } else if (selectedMethod === 'card') {
      onPaymentComplete({
        method: 'card',
        amount: totalAmount,
      });
    } else if (selectedMethod === 'e-wallet' && eWalletProvider) {
      onPaymentComplete({
        method: 'e-wallet',
        amount: totalAmount,
        eWalletProvider,
      });
    }
  };

  const quickAmounts = [
    totalAmount,
    Math.ceil(totalAmount / 50000) * 50000,
    Math.ceil(totalAmount / 100000) * 100000,
  ];

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
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Total Tagihan</p>
            <p className="text-3xl font-mono font-bold text-pos-coral">
              {formatPrice(totalAmount)}
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Method Selection */}
          {!selectedMethod && (
            <div className="grid grid-cols-3 gap-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedMethod('cash')}
                className="p-6 border-2 border-gray-200 rounded-2xl hover:border-pos-coral hover:bg-orange-50 transition-all"
              >
                <Banknote className="w-10 h-10 mx-auto mb-3 text-pos-coral" />
                <p className="font-bold text-pos-charcoal">Tunai</p>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedMethod('card')}
                className="p-6 border-2 border-gray-200 rounded-2xl hover:border-pos-coral hover:bg-orange-50 transition-all"
              >
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-pos-coral" />
                <p className="font-bold text-pos-charcoal">Kartu</p>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedMethod('e-wallet')}
                className="p-6 border-2 border-gray-200 rounded-2xl hover:border-pos-coral hover:bg-orange-50 transition-all"
              >
                <Smartphone className="w-10 h-10 mx-auto mb-3 text-pos-coral" />
                <p className="font-bold text-pos-charcoal">E-Wallet</p>
              </motion.button>
            </div>
          )}

          {/* Cash Payment */}
          {selectedMethod === 'cash' && (
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
                {quickAmounts.map((amount) => (
                  <Button
                    key={amount}
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
                  onClick={handlePayment}
                  disabled={!cashAmount || parseFloat(cashAmount) < totalAmount}
                  className="flex-1 h-12 bg-pos-coral hover:bg-orange-600"
                >
                  Selesaikan Pembayaran
                </Button>
              </div>
            </motion.div>
          )}

          {/* Card Payment */}
          {selectedMethod === 'card' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="p-6 bg-gray-50 rounded-xl text-center">
                <Zap className="w-16 h-16 mx-auto mb-4 text-pos-coral animate-pulse" />
                <p className="text-lg font-medium text-pos-charcoal mb-2">
                  Memproses Pembayaran Kartu
                </p>
                <p className="text-sm text-gray-600">
                  Silakan masukkan atau tempel kartu pada pembaca kartu
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

          {/* E-Wallet Payment */}
          {selectedMethod === 'e-wallet' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Label className="text-base">Pilih Penyedia E-Wallet</Label>
              <div className="grid grid-cols-2 gap-3">
                {['GoPay', 'OVO', 'DANA', 'ShopeePay'].map((provider) => (
                  <Button
                    key={provider}
                    variant={eWalletProvider === provider ? 'default' : 'outline'}
                    onClick={() => setEWalletProvider(provider)}
                    className="h-14 text-base"
                  >
                    {provider}
                  </Button>
                ))}
              </div>

              {eWalletProvider && (
                <div className="p-6 bg-gray-50 rounded-xl text-center">
                  <Smartphone className="w-16 h-16 mx-auto mb-4 text-pos-coral" />
                  <p className="text-lg font-medium text-pos-charcoal mb-2">
                    Pindai Kode QR dengan {eWalletProvider}
                  </p>
                  <p className="text-sm text-gray-600">
                    Tunjukkan kode QR kepada pelanggan
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
                  onClick={handlePayment}
                  disabled={!eWalletProvider}
                  className="flex-1 h-12 bg-pos-coral hover:bg-orange-600"
                >
                  Selesaikan Pembayaran
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
