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
    private currentRequestId: number = 0;
    private initializationPromise: Promise<any> | null = null;

    private async loadDevicesModule() {
        if (this.devicesModule) return this.devicesModule;
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = (async () => {
            const win = window as any;
            // Check if globals from index.html are already there
            if (win.dp && win.dp.devices) {
                this.devicesModule = win.dp.devices;
                return this.devicesModule;
            }

            console.log('[Fp Service] Waiting for DigitalPersona SDK globals...');
            
            // Verification step: check if scripts are even present in head
            const scriptTags = Array.from(document.querySelectorAll('script[src*="digitalpersona"]'));
            if (scriptTags.length === 0) {
                console.warn('[Fp Service] No DigitalPersona script tags found in index.html!');
            }

            for (let i = 0; i < 15; i++) {
                await new Promise(resolve => setTimeout(resolve, 300));
                if (win.dp && win.dp.devices) {
                    this.devicesModule = win.dp.devices;
                    return this.devicesModule;
                }
            }

            const isVercel = window.location.hostname.includes('vercel.app');
            let errorMsg = "SDK Fingerprint (dp.devices) tidak ditemukan.";
            if (isVercel) {
                errorMsg += " File library (.js) mungkin tidak ditemukan di server Vercel. Pastikan folder 'public/lib/digitalpersona' telah di-push ke Git dan ter-deploy.";
            }

            throw new Error(errorMsg);
        })();

        try {
            return await this.initializationPromise;
        } finally {
            this.initializationPromise = null;
        }
    }

    private getDpModule(moduleName: 'devices' | 'core' | 'services') {
        const win = window as any;
        const mod = win.dp?.[moduleName];
        if (!mod) {
            console.error(`[Fp Service] Library @digitalpersona/${moduleName} not found in global scope.`);
            throw new Error(`Modul fingerprint (${moduleName}) tidak dapat dimuat.`);
        }
        return mod;
    }

    private async initReader(port: number) {
        const { FingerprintReader } = this.getDpModule('devices');
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

    private onAcquisitionStarted = (event: any) => {
        console.log('DigitalPersona: Acquisition Started Event', event);
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

    async checkServiceAvailability(): Promise<{ available: boolean; error?: string; errorType?: string }> {
        try {
            if (!this.initialized) {
                await this.loadDevicesModule();
                const isHttps = window.location.protocol === 'https:';
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];
                let success = false;
                let lastError = '';
                
                console.log(`[Fp Service] Probing Availability... Origin: ${window.location.origin}`);

                for (const port of portsToTry) {
                    try {
                        console.log(`[Fp Service] Testing Port ${port}...`);
                        await this.initReader(port);
                        // Enumerate devices quickly
                        const devices = await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 2000, 'Timeout');
                        console.log(`[Fp Service] Success on port ${port}. Devices found: ${devices.length}`);
                        success = true;
                        break;
                    } catch (e: any) {
                        lastError = e?.message || 'Unknown error';
                        const isMixedContent = lastError.includes('Mixed Content') || lastError.includes('Insecure');
                        const isCertError = lastError.includes('cert') || lastError.includes('authority');
                        
                        console.warn(`[Fp Service] Port ${port} failed. Msg: ${lastError} (Mixed: ${isMixedContent}, Cert: ${isCertError})`);
                    }
                }
                if (!success) {
                    const isHttps = window.location.protocol === 'https:';
                    return {
                        available: false,
                        error: isHttps 
                            ? 'Layanan tidak merespon di HTTPS. Biasanya karena masalah Sertifikat SSL Local atau Private Network Access browser.'
                            : 'Layanan tidak merespon. Pastikan "DigitalPersona Biometric Service" berjalan.',
                        errorType: isHttps ? 'HTTPS_PROHIBITED' : 'SERVICE_MISSING'
                    };
                }
                this.initialized = true;
            }
            return { available: true };
        } catch (e: any) {
            return {
                available: false,
                error: e.message || 'Gagal inisialisasi SDK.',
                errorType: 'SDK_LOAD_ERROR'
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
        const globalTimeout = setTimeout(() => {
            if (this.isBusy && !this.isCapturing) {
                this.isBusy = false;
                onStatusUpdate('ERROR', {
                    success: false,
                    message: 'Gagal menghubungkan ke scanner (Service Timeout).',
                    errorType: 'SERVICE_NOT_RUNNING'
                });
            }
        }, 10000); 

        // New request ID to ignore late callbacks from previous attempts
        const requestId = ++this.currentRequestId;
        const safeOnStatusUpdate: FingerprintCallback = (status, result) => {
            if (this.currentRequestId !== requestId) {
                console.warn(`[Fp Service] Ignoring callback for old request ${requestId} (Current: ${this.currentRequestId})`);
                return;
            }
            onStatusUpdate(status, result);
        };

        try {
            await this.stopCapture(); // Force clean previous state
            this.scanCallback = safeOnStatusUpdate;
            this.isBusy = true;
            this.currentMode = mode;
            let device = this.cachedDevice;
            safeOnStatusUpdate('Menghubungkan...');

            if (!this.initialized) {
                const modules = await this.loadDevicesModule();
                const isHttps = window.location.protocol === 'https:';
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];
                let success = false;
                
                console.log(`[Fp Service] Initializing on ${isHttps ? 'HTTPS' : 'HTTP'}`);

                for (const port of portsToTry) {
                    try {
                        safeOnStatusUpdate(`Menghubungkan ke Layanan (Port ${port})...`);
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

            if (this.currentRequestId !== requestId) return;

            if (!device) {
                safeOnStatusUpdate('Mencari Alat...');
                const devices = await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 10000, 'Gagal mendeteksi alat');
                if (!devices || (devices as any[]).length === 0) {
                    safeOnStatusUpdate('ERROR', { success: false, message: 'Alat fingerprint tidak terdeteksi.', errorType: 'NO_DEVICE' });
                    this.isBusy = false;
                    return;
                }
                device = devices[0];
                this.cachedDevice = device;
            }

            if (this.currentRequestId !== requestId) return;

            const { SampleFormat } = this.getDpModule('devices');
            safeOnStatusUpdate('Menyiapkan Scanner...');
            await this.withTimeout(
                this.reader.startAcquisition(SampleFormat.Intermediate, device),
                10000, 'Gagal memulai pemindaian (Timeout).'
            );
            
            console.log('[Fp Service] Acquisition started successfully');
            clearTimeout(globalTimeout);
            
            if (this.currentRequestId !== requestId) {
                console.warn('[Fp Service] Request ID changed after startAcquisition, stopping.');
                await this.reader.stopAcquisition();
                return;
            }

            this.isCapturing = true;
            this.isBusy = false;
            // Force status update to be sure
            safeOnStatusUpdate('WAITING_FOR_FINGER');

        } catch (err: any) {
            clearTimeout(globalTimeout);
            this.isBusy = false;
            this.isCapturing = false;

            // Handle 0x80070057 specifically
            let finalMessage = err.message || 'Gagal inisialisasi hardware.';
            if (finalMessage.includes('80070057')) {
                finalMessage = 'Alat sedang sibuk atau digunakan di tab lain (Error 0x80070057). Mohon tutup tab lain atau cabut-pasang USB scanner.';
            }

            safeOnStatusUpdate('ERROR', {
                success: false,
                message: finalMessage,
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
