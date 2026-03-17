// src/lib/fingerprint.ts
// IMPORTANT: @digitalpersona/devices is loaded lazily via dynamic import
// to prevent WebSdk (which contains legacy `var async` code) from being
// bundled into the main chunk and crashing due to ES module reserved keyword conflict.

export interface FingerprintResult {
    success: boolean;
    template?: string;
    message?: string;
    errorType?: 'NO_DEVICE' | 'SERVICE_NOT_RUNNING' | 'SCAN_FAILED' | 'UNKNOWN';
}

export type FingerprintCallback = (status: string, result?: FingerprintResult) => void;

class FingerprintService {
    private reader: any = null;
    private isCapturing = false;
    private isBusy = false;
    private scanCallback: FingerprintCallback | null = null;
    private currentMode: 'CAPTURE' | 'ENROLL' = 'CAPTURE';
    private cachedDevice: any = null;
    private busyTimeout: NodeJS.Timeout | null = null;
    private currentPort: number = 52181;
    private initialized: boolean = false;
    private devicesModule: any = null;

    private async loadDevicesModule() {
        if (this.devicesModule) return this.devicesModule;
        try {
            // Dynamic import — keeps WebSdk out of the initial bundle
            this.devicesModule = await import('@digitalpersona/devices');
            return this.devicesModule;
        } catch (err) {
            console.error('Failed to load @digitalpersona/devices:', err);
            throw new Error('Modul fingerprint tidak dapat dimuat.');
        }
    }

    private async initReader(port: number) {
        const { FingerprintReader } = await this.loadDevicesModule();
        this.reader = new FingerprintReader({ port });
        this.currentPort = port;

        this.reader.on('DeviceConnected', this.onDeviceConnected);
        this.reader.on('DeviceDisconnected', this.onDeviceDisconnected);
        this.reader.on('SamplesAcquired', this.onSamplesAcquired);
        this.reader.on('AcquisitionStarted', this.onAcquisitionStarted);
        this.reader.on('AcquisitionStopped', this.onAcquisitionStopped);
    }

    private onDeviceConnected = (event: any) => {
        console.log('DigitalPersona: Device Connected', event);
        if (this.scanCallback) this.scanCallback('ALAT_TERDETEKSI');
    };

    private onDeviceDisconnected = (event: any) => {
        console.warn('DigitalPersona: Device Disconnected', event);
        this.cachedDevice = null;
        
        // Notify UI immediately if we are in middle of anything
        if (this.scanCallback) {
            this.scanCallback('ERROR', {
                success: false,
                message: 'Alat fingerprint terputus. Pastikan kabel USB terpasang dengan kuat.',
                errorType: 'NO_DEVICE'
            });
            // stopCapture will clean up reader state and reset isBusy/isCapturing
            this.stopCapture();
        }
    };

    private onAcquisitionStarted = (_event: any) => {
        console.log('DigitalPersona: Acquisition Started');
        if (this.scanCallback) this.scanCallback('WAITING_FOR_FINGER');
    };

    private onAcquisitionStopped = (_event: any) => {
        console.log('DigitalPersona: Acquisition Stopped');
        this.isCapturing = false;
        this.isBusy = false;
        if (this.busyTimeout) {
            clearTimeout(this.busyTimeout);
            this.busyTimeout = null;
        }
    };

    private onSamplesAcquired = (event: any) => {
        console.log('DigitalPersona: Samples Acquired');
        if (!this.scanCallback) return;
        try {
            if (event.samples && event.samples.length > 0) {
                // DigitalPersona samples can be a raw string or an object with a Data property
                let rawData = event.samples[0].Data || event.samples[0];
                
                // If it's an object, try to extract the base64 string
                let template = '';
                if (typeof rawData === 'string') {
                    template = rawData;
                } else {
                    try {
                        // Sometimes it's wrapped in a way that JSON.stringify is needed, 
                        // but we want the rawest possible data for matching.
                        template = JSON.stringify(rawData);
                    } catch (e) {
                        template = String(rawData);
                    }
                }

                // If the template looks like a JSON object containing Data, unwrap it
                if (template.startsWith('{"Data":')) {
                    try {
                        const parsed = JSON.parse(template);
                        if (parsed.Data) template = parsed.Data;
                    } catch (e) {}
                }

                console.log(`DigitalPersona: Captured template length: ${template.length}`);

                this.scanCallback('SUCCESS', {
                    success: true,
                    template,
                    message: this.currentMode === 'ENROLL' ? 'Sidik jari berhasil didaftarkan' : 'Sidik jari berhasil dibaca'
                });
            } else {
                this.scanCallback('ERROR', {
                    success: false,
                    message: 'Kualitas scan jari kurang baik. Coba bersihkan jari atau tekan lebih mantap.',
                    errorType: 'SCAN_FAILED'
                });
            }
        } catch (error) {
            console.error('Error processing sample:', error);
            this.scanCallback('ERROR', {
                success: false,
                message: 'Gagal memproses sampel sidik jari.',
                errorType: 'SCAN_FAILED'
            });
        } finally {
            this.stopCapture();
        }
    };

    private withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
        let timeoutHandle: NodeJS.Timeout;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        });
        return Promise.race([
            promise.then(result => { clearTimeout(timeoutHandle); return result; }),
            timeoutPromise
        ]);
    }

    forceResetBusy() {
        console.log('DigitalPersona: Force resetting busy state');
        this.isBusy = false;
        if (this.busyTimeout) { clearTimeout(this.busyTimeout); this.busyTimeout = null; }
    }

    getCurrentPort() { return this.currentPort; }

    getServiceUrls() {
        return [
            { port: 52181, protocol: 'HTTP', url: 'http://127.0.0.1:52181/get_connection' },
            { port: 52182, protocol: 'HTTPS', url: 'https://127.0.0.1:52182/get_connection' },
            { port: 8080, protocol: 'HTTP', url: 'http://127.0.0.1:8080/DPBiotek/Fingerprint/Status' },
        ];
    }

    async checkServiceAvailability(): Promise<{ available: boolean; error?: string }> {
        try {
            if (!this.initialized) {
                const isHttps = window.location.protocol === 'https:';
                // Try HTTPS port first if we are on HTTPS, but fall back to HTTP
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];
                let success = false;
                let lastError = '';
                
                console.log(`[Fp Service] Checking availability (HTTPS: ${isHttps})`);

                for (const port of portsToTry) {
                    try {
                        console.log(`[Fp Service] Probing port ${port}...`);
                        await this.initReader(port);
                        // Enumerate devices to verify service is actually responding
                        const devices = await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 2000, 'Timeout');
                        console.log(`[Fp Service] Port ${port} is responding. Devices count: ${devices.length}`);
                        success = true;
                        break;
                    } catch (e: any) {
                        lastError = e?.message || 'Unknown error';
                        console.warn(`[Fp Service] Port ${port} failed: ${lastError}`);
                    }
                }
                if (!success) throw new Error(`Layanan tidak merespon.`);
                this.initialized = true;
            }
            return { available: true };
        } catch {
            return {
                available: false,
                error: 'Service @digitalpersona/devices tidak merespon. Pastikan "DigitalPersona Biometric Service" berjalan.'
            };
        }
    }

    async refreshDevices() {
        try {
            const devices = await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 10000, 'Refresh devices timed out');
            if (devices && (devices as any[]).length > 0) { this.cachedDevice = (devices as any[])[0]; return devices; }
            this.cachedDevice = null;
            return [];
        } catch (err) {
            console.error('Error refreshing devices:', err);
            this.cachedDevice = null;
            return [];
        }
    }

    async startCapture(onStatusUpdate: FingerprintCallback, mode: 'CAPTURE' | 'ENROLL' = 'CAPTURE') {
        if (this.isCapturing) return;
        this.scanCallback = onStatusUpdate;
        this.currentMode = mode;
        if (this.isBusy) {
            if (!this.busyTimeout) this.isBusy = false;
            else { onStatusUpdate('ERROR', { success: false, message: 'Alat sedang sibuk.', errorType: 'UNKNOWN' }); return; }
        }

        const globalTimeout = setTimeout(() => {
            if (this.isBusy && !this.isCapturing) {
                this.isBusy = false;
                onStatusUpdate('ERROR', {
                    success: false,
                    message: 'Gagal menghubungkan ke scanner (Service Timeout).',
                    errorType: 'SERVICE_NOT_RUNNING'
                });
            }
        }, 10000); // Reduced to 10s

        try {
            this.isBusy = true;
            onStatusUpdate('Menghubungkan...');

            if (!this.initialized) {
                const modules = await this.loadDevicesModule();
                const isHttps = window.location.protocol === 'https:';
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];
                let success = false;
                
                console.log(`[Fp Service] Initializing on ${isHttps ? 'HTTPS' : 'HTTP'}`);

                for (const port of portsToTry) {
                    try {
                        onStatusUpdate(`Menghubungkan ke Layanan (Port ${port})...`);
                        await this.initReader(port);
                        await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 3000, `Timeout di Port ${port}`);
                        success = true;
                        console.log(`[Fp Service] Successfully connected to port ${port}`);
                        break;
                    } catch (e: any) {
                        console.warn(`[Fp Service] Port ${port} connect failed: ${e.message}`);
                    }
                }
                if (!success) {
                    const helpMsg = isHttps ? 
                        'Gagal terhubung. Jika menggunakan HTTPS, pastikan Anda telah mengizinkan sertifikat SSL di https://127.0.0.1:52182 atau gunakan localhost.' :
                        'Layanan biometrik tidak merespon. Pastikan DigitalPersona service berjalan.';
                    throw new Error(helpMsg);
                }
                this.initialized = true;
            }

            let device = this.cachedDevice;
            if (!device) {
                onStatusUpdate('Mencari Alat...');
                const devices = await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 10000, 'Gagal mendeteksi alat');
                if (!devices || (devices as any[]).length === 0) {
                    onStatusUpdate('ERROR', { success: false, message: 'Alat fingerprint tidak terdeteksi.', errorType: 'NO_DEVICE' });
                    this.isBusy = false;
                    return;
                }
                device = devices[0];
                this.cachedDevice = device;
            }

            const { SampleFormat } = await this.loadDevicesModule();
            onStatusUpdate('Menyiapkan Scanner...');
            await this.withTimeout(
                this.reader.startAcquisition(SampleFormat.Intermediate, device),
                10000, 'Gagal memulai pemindaian (Timeout).'
            );
            clearTimeout(globalTimeout);
            this.isCapturing = true;
            this.isBusy = false;

        } catch (err: any) {
            clearTimeout(globalTimeout);
            this.isBusy = false;
            this.isCapturing = false;
            onStatusUpdate('ERROR', {
                success: false,
                message: err.message || 'Gagal inisialisasi hardware.',
                errorType: 'SERVICE_NOT_RUNNING'
            });
        }
    }

    async stopCapture() {
        if (this.isCapturing && this.reader) {
            try {
                await this.withTimeout(this.reader.stopAcquisition(), 3000, 'Stop acquisition timed out');
            } catch (err) {
                console.warn('Error stopping acquisition', err);
            }
        }
        this.isCapturing = false;
        this.isBusy = false;
        this.scanCallback = null;
    }

    mockCapture(onStatusUpdate: FingerprintCallback, shouldSuccess: boolean = true) {
        onStatusUpdate('WAITING_FOR_FINGER');
        setTimeout(() => {
            if (shouldSuccess) {
                onStatusUpdate('SUCCESS', {
                    success: true,
                    template: 'MOCK_BASE64_TEMPLATE_123456789',
                    message: 'Sidik jari berhasil dibaca (Mock)'
                });
            } else {
                onStatusUpdate('ERROR', {
                    success: false,
                    message: 'Sidik jari tidak dikenali (Mock)',
                    errorType: 'SCAN_FAILED'
                });
            }
        }, 2500);
    }

    /**
     * Centralized Similarity Algorithm for Fingerprint Templates (FMD/Base64)
     * Uses Sørensen–Dice coefficient with character Bigrams.
     * Bigrams (size 2) are more forgiving than Trigrams for noisy biometric data.
     */
    calculateSimilarity(str1: string, str2: string): number {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 100;

        // Strip headers (approx 40-50 chars for DigitalPersona FMD in Base64) 
        // to avoid comparing fixed metadata like SDK version/type.
        const clean = (s: string) => {
            if (s.length < 100) return s;
            // conservative strip for better compatibility
            return s.substring(40, s.length - 10);
        };

        const s1 = clean(str1);
        const s2 = clean(str2);

        if (s1.length < 10 || s2.length < 10) return 0;

        // Generate Bigrams (2-char sequences)
        const getBigrams = (str: string) => {
            const bigrams = new Set<string>();
            for (let i = 0; i < str.length - 1; i++) {
                bigrams.add(str.substring(i, i + 2));
            }
            return bigrams;
        };

        const b1 = getBigrams(s1);
        const b2 = getBigrams(s2);

        if (b1.size === 0 || b2.size === 0) return 0;

        let intersection = 0;
        b1.forEach(bigram => {
            if (b2.has(bigram)) intersection++;
        });

        // Dice Coefficient formula: (2 * intersection) / (total size)
        const score = (2 * intersection) / (b1.size + b2.size) * 100;
        
        // Log detailed diagnostic for the "0% issue"
        console.log(`[Fp Match] Diagnostic: S1 Len=${str1.length} -> ${s1.length}, S2 Len=${str2.length} -> ${s2.length}`);
        console.log(`[Fp Match] Diagnostic: H1=${s1.substring(0, 15)}... H2=${s2.substring(0, 15)}...`);
        console.log(`[Fp Match] Diagnostic: Intersection=${intersection}, Total Bigrams=${b1.size + b2.size}, Final Score=${score.toFixed(2)}%`);

        return score;
    }
}

export const fingerprint = new FingerprintService();
