import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function PWAInstallButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                toast.success('Aplikasi berhasil diinstall!');
                setDeferredPrompt(null);
            }
        } else {
            // Manual Instructions
            if (isIOS) {
                toast.info('Untuk iOS: Klik tombol "Share" (kotak panah) lalu pilih "Add to Home Screen"', { duration: 5000 });
            } else {
                toast.info('Jika tidak muncul otomatis: Klik menu browser (titik tiga) -> "Install App" atau "Add to Home Screen". Pastikan Anda menggunakan Chrome.', { duration: 5000 });
            }
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
            onClick={handleInstallClick}
        >
            <Download className="w-4 h-4" />
            <span className="text-xs font-bold">Install App</span>
        </Button>
    );
}
