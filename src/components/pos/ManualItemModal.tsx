import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackagePlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface ManualItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (item: { name: string; price: number }) => void;
}

export function ManualItemModal({
    open,
    onOpenChange,
    onAdd,
}: ManualItemModalProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');

    useEffect(() => {
        if (open) {
            setName('');
            setPrice('');
        }
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        // Remove both dots and commas to handle various thousands separator styles
        const cleanPrice = price.replace(/[.,]/g, '');
        const numericPrice = parseFloat(cleanPrice);

        if (!trimmedName) {
            toast.error('Nama item tidak boleh kosong');
            return;
        }

        if (isNaN(numericPrice)) {
            toast.error('Harga tidak valid');
            return;
        }

        onAdd({
            name: trimmedName,
            price: numericPrice,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md z-[1000]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <PackagePlus className="w-6 h-6 text-pos-coral" />
                        Item Manual
                    </DialogTitle>
                    <DialogDescription>
                        Masukkan nama dan harga untuk item tambahan manual.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Item</Label>
                            <Input
                                id="name"
                                placeholder="Contoh: Jasa Titip, Custom Menu..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 border-gray-200 focus:border-pos-coral focus:ring-pos-coral/20"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="price">Harga (IDR)</Label>
                            <Input
                                id="price"
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={price}
                                onChange={(e) => {
                                    // Allow only numbers and separators
                                    const val = e.target.value.replace(/[^0-9,.]/g, '');
                                    setPrice(val);
                                }}
                                className="h-12 font-mono text-lg border-gray-200 focus:border-pos-coral focus:ring-pos-coral/20"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-12"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={!name || !price}
                            className="flex-1 h-12 bg-pos-coral hover:bg-orange-600 shadow-lg shadow-orange-200"
                        >
                            Tambah ke Order
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
