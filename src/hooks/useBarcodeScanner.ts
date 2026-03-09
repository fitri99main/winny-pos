import { useEffect, useRef, useState } from 'react';

interface UseBarcodeScannerProps {
    onScan: (code: string) => void;
    enabled?: boolean;
    minBufferLength?: number;
    bufferTimeout?: number;
}

/**
 * Hook to listen for barcode scanner input (HID mode).
 * Scanners typically send characters rapidly followed by an "Enter" key.
 */
export function useBarcodeScanner({
    onScan,
    enabled = true,
    minBufferLength = 3,
    bufferTimeout = 100,
}: UseBarcodeScannerProps) {
    const [buffer, setBuffer] = useState('');
    const lastInputTime = useRef<number>(0);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore events targeting input/textarea/select unless we want global capture
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                // If it's an input, we might still want to capture if it's the scanner
                // but typically scanners act like a keyboard and might mess up forms.
                // For 'Attendance' and 'Purchases', we often want global capture.
            }

            const now = Date.now();

            // If the time between keystrokes is too long, reset the buffer
            // (This distinguishes scanner entry from manual typing)
            if (now - lastInputTime.current > bufferTimeout) {
                setBuffer('');
            }
            lastInputTime.current = now;

            if (e.key === 'Enter') {
                if (buffer.length >= minBufferLength) {
                    onScan(buffer);
                    setBuffer('');
                    // Prevent form submissions if the scanner is used while a form is open
                    e.preventDefault();
                } else {
                    setBuffer('');
                }
            } else if (e.key.length === 1) {
                // Only append printable characters
                setBuffer((prev) => prev + e.key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, buffer, onScan, minBufferLength, bufferTimeout]);

    return {
        buffer,
        clearBuffer: () => setBuffer(''),
    };
}
