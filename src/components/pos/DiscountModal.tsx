import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyDiscount: (discount: {
    type: 'percentage' | 'fixed';
    value: number;
    reason: string;
  }) => void;
  currentTotal: number;
}

export function DiscountModal({
  open,
  onOpenChange,
  onApplyDiscount,
  currentTotal,
}: DiscountModalProps) {
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [reason, setReason] = useState('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const calculateDiscountAmount = () => {
    const value = parseFloat(discountValue) || 0;
    if (discountType === 'percentage') {
      return (currentTotal * value) / 100;
    }
    return value;
  };

  const handleApply = () => {
    const value = parseFloat(discountValue) || 0;
    if (value > 0 && reason) {
      onApplyDiscount({ type: discountType, value, reason });
      setDiscountValue('');
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Terapkan Diskon</DialogTitle>
          <DialogDescription>
            Pilih tipe dan jumlah diskon yang ingin diterapkan pada pesanan ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Tipe Diskon</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={discountType === 'percentage' ? 'default' : 'outline'}
                onClick={() => setDiscountType('percentage')}
                className="h-12"
              >
                Percentage (%)
              </Button>
              <Button
                type="button"
                variant={discountType === 'fixed' ? 'default' : 'outline'}
                onClick={() => setDiscountType('fixed')}
                className="h-12"
              >
                Jumlah Tetap
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {discountType === 'percentage' ? 'Persentase' : 'Jumlah'}
            </Label>
            <Input
              type="number"
              placeholder={discountType === 'percentage' ? 'misal: 10' : 'misal: 5000'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="h-12 text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Alasan</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Pilih alasan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="promotion">Promosi</SelectItem>
                <SelectItem value="loyalty">Diskon Loyalitas</SelectItem>
                <SelectItem value="employee">Diskon Karyawan</SelectItem>
                <SelectItem value="manager">Persetujuan Manajer</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {discountValue && (
            <div className="p-4 bg-gray-50 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Saat Ini</span>
                <span className="font-mono font-medium">
                  {formatPrice(currentTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Diskon</span>
                <span className="font-mono font-medium text-red-500">
                  -{formatPrice(calculateDiscountAmount())}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-bold">Total Baru</span>
                <span className="font-mono font-bold text-pos-coral">
                  {formatPrice(currentTotal - calculateDiscountAmount())}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleApply}
            disabled={!discountValue || !reason}
            className="w-full h-12 text-base bg-pos-coral hover:bg-orange-600"
          >
            Terapkan Diskon
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
