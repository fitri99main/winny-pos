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
    private isStarting = false; // NEW: Track if we are in middle of 'start' sequence
    private scanCallback: FingerprintCallback | null = null;
    private currentMode: 'CAPTURE' | 'ENROLL' = 'CAPTURE';
    private cachedDevice: any = null;
    private busyTimeout: NodeJS.Timeout | null = null;
    private currentPort: number = 52181;
    private initialized: boolean = false;
    private listenersAttached: boolean = false;
    private devicesModule: any = null;
    private currentRequestId: number = 0;
    private initializationPromise: Promise<any> | null = null;
    private stopResolver: (() => void) | null = null;
    private stopPromise: Promise<void> | null = null;
    private lastStopTimestamp: number = 0; // NEW: Prevent rapid re-start
    private executionMutex: Promise<void> = Promise.resolve(); // NEW: Strict execution queue

    private async runLocked<T>(task: () => Promise<T>): Promise<T> {
        let release: () => void;
        const nextLock = new Promise<void>(resolve => { release = resolve; });
        const currentLock = this.executionMutex;
        this.executionMutex = nextLock;

        try {
            await currentLock;
            return await task();
        } finally {
            release!();
        }
    }

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
        if (this.reader) {
            try {
                this.reader.off('DeviceConnected', this.onDeviceConnected);
                this.reader.off('DeviceDisconnected', this.onDeviceDisconnected);
                this.reader.off('SamplesAcquired', this.onSamplesAcquired);
                this.reader.off('AcquisitionStarted', this.onAcquisitionStarted);
                this.reader.off('AcquisitionStopped', this.onAcquisitionStopped);
            } catch (e) {
                console.warn('[Fp Service] Error removing old listeners', e);
            }
        }

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
        if (this.stopResolver) {
            this.stopResolver();
            this.stopResolver = null;
            this.stopPromise = null;
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
                        // Enumerate devices quickly - use shorter 2s timeout for probing
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
    async startCapture(onStatusUpdate: FingerprintCallback, mode: 'CAPTURE' | 'ENROLL' = 'CAPTURE', requestId?: number, retryCount: number = 0) {
        return this.runLocked(async () => {
            // STEP 0: Prevent concurrent 'start' calls
            if (this.isStarting && !requestId) {
                console.warn('[Fp Service] startCapture called while another start is in progress. Ignoring.');
                return;
            }
            
            const currentId = requestId || ++this.currentRequestId;
            if (!requestId) {
                this.currentRequestId = currentId;
                this.isStarting = true;
            }

            const cleanup = () => {
                if (this.currentRequestId === currentId) {
                    this.isStarting = false;
                }
            };

            const safeOnStatusUpdate: FingerprintCallback = (status, result) => {
                if (this.currentRequestId !== currentId) return;
                onStatusUpdate(status, result);
            };

            try {
                // STEP 1: Strict Cooldown - Give Windows Driver time to breathe
                // Final attempts get much longer cooldowns
                const requiredCooldown = retryCount === 2 ? 5000 : 1800;
                const timeSinceLastStop = Date.now() - this.lastStopTimestamp;
                if (timeSinceLastStop < requiredCooldown) {
                    console.log(`[Fp Service] Cooldown active (${requiredCooldown - timeSinceLastStop}ms remaining)...`);
                    await new Promise(r => setTimeout(r, requiredCooldown - timeSinceLastStop));
                }

                // STEP 2: Ensure hardware is released
                safeOnStatusUpdate('Menyiapkan Alat...');
                await this.stopCapture(); 
                if (this.stopPromise) await this.stopPromise;

                this.scanCallback = safeOnStatusUpdate;
                this.isBusy = true;
                this.currentMode = mode;
                let device = this.cachedDevice;
                
                safeOnStatusUpdate('Menghubungkan ke Layanan...');

                if (!this.initialized || retryCount > 0) {
                    const modules = await this.loadDevicesModule();
                    const isHttps = window.location.protocol === 'https:';
                    
                    // PORT ROTATION: Try alternative port if busy
                    const basePorts = isHttps ? [52182, 52181] : [52181, 52182, 8080];
                    const portsToTry = retryCount > 0 ? [...basePorts].reverse() : basePorts;
                    
                    let success = false;
                    for (const port of portsToTry) {
                        try {
                            safeOnStatusUpdate(`Mencoba Port ${port}...`);
                            await this.initReader(port);
                            // Enumerate devices quickly
                            const devices = await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 2500, 'Port limit');
                            success = true;
                            break;
                        } catch (e: any) {
                            console.warn(`[Fp Service] Port ${port} probe failed: ${e.message}`);
                        }
                    }
                    
                    if (!success) {
                        throw new Error(isHttps ? 'Masalah Sertifikat SSL (HTTPS). Buka https://127.0.0.1:52182 lalu klik "Advanced" & "Proceed".' : 'Layanan Fingerprint tidak aktif.');
                    }
                    this.initialized = true;
                }

                if (this.currentRequestId !== currentId) return cleanup();

                if (!device) {
                    safeOnStatusUpdate('Mencari Alat...');
                    const devices = await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 5000, 'Pastikan USB terpasang');
                    if (!devices || (devices as any[]).length === 0) {
                        throw new Error('Alat tidak terdeteksi. Cabut dan pasang kembali USB.');
                    }
                    device = devices[0];
                    this.cachedDevice = device;
                }

                if (this.currentRequestId !== currentId) return cleanup();

                const { SampleFormat } = this.getDpModule('devices');
                safeOnStatusUpdate('Mengaktifkan Scanner...');
                
                try {
                    await this.withTimeout(
                        this.reader.startAcquisition(SampleFormat.Intermediate, device),
                        8000, 'Scanner tidak merespon.'
                    );
                } catch (e: any) {
                    // AGGRESSIVE RECOVERY for Error 80070057 (Device Busy)
                    if ((e.message?.includes('80070057') || e.message?.toLowerCase().includes('busy')) && retryCount < 3) {
                        console.error(`[Fp Service] BUSY detected (Attempt ${retryCount + 1}/3). Nuclear recovery...`);
                        safeOnStatusUpdate('MEMULIHKAN_ALAT_SIBUK');
                        
                        await this.hardReset();
                        // Recursive retry will be wrapped in its own runLocked naturally
                        return this.startCapture(onStatusUpdate, mode, currentId, retryCount + 1);
                    }
                    throw e;
                }
                
                console.log('[Fp Service] Acquisition successfully started');
                this.isCapturing = true;
                this.isBusy = false;
                this.isStarting = false; // Successfully started
                safeOnStatusUpdate('WAITING_FOR_FINGER');

            } catch (err: any) {
                this.isBusy = false;
                this.isCapturing = false;
                this.isStarting = false;

                console.error('[Fp Service] Capture Failed:', err.message);
                let finalMessage = err.message || 'Gagal menyiapkan hardware.';
                
                if (finalMessage.includes('80070057')) {
                    finalMessage = 'Alat sibuk (Error 80070057). Mohon cabut-pasang USB atau restart DigitalPersona service.';
                }

                onStatusUpdate('ERROR', {
                    success: false,
                    message: finalMessage,
                    errorType: finalMessage.includes('tidak terdeteksi') ? 'NO_DEVICE' : 'UNKNOWN'
                });
            }
        });
    }

    async stopCapture() {
        if (!this.reader) {
            this.isCapturing = false;
            this.isBusy = false;
            this.isStarting = false;
            return Promise.resolve();
        }

        // If already stopping, return the existing promise
        if (this.stopPromise) return this.stopPromise;

        this.stopPromise = new Promise((resolve) => {
            this.stopResolver = resolve;
            
            // Safety timeout: if hardware never sends stopped event, resolve anyway
            setTimeout(() => {
                if (this.stopResolver) {
                    console.warn('[Fp Service] Stop sequence timed out, forcing release.');
                    this.lastStopTimestamp = Date.now();
                    this.stopResolver();
                    this.stopResolver = null;
                }
            }, 2000);

            try {
                this.reader.stopAcquisition().then(() => {
                    this.lastStopTimestamp = Date.now();
                }).catch((err: any) => {
                    console.warn('[Fp Service] stopAcquisition failed:', err.message);
                    this.lastStopTimestamp = Date.now();
                    if (this.stopResolver) {
                        this.stopResolver();
                        this.stopResolver = null;
                    }
                });
            } catch (err) {
                this.lastStopTimestamp = Date.now();
                if (this.stopResolver) {
                    this.stopResolver();
                    this.stopResolver = null;
                }
            }
        });

        return this.stopPromise;
    }

    mockCapture(onStatusUpdate: FingerprintCallback, shouldSuccess: boolean = true) {
        onStatusUpdate('WAITING_FOR_FINGER');
        setTimeout(() => {
            if (shouldSuccess) {
                onStatusUpdate('SUCCESS', {
                    success: true,
                    template: 'TPL_MOCK_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                    message: 'Sidik jari berhasil dibaca (Mock)'
                });
            } else {
                onStatusUpdate('ERROR', {
                    success: false,
                    message: 'Sidik jari tidak dikenali (Mock)',
                    errorType: 'SCAN_FAILED'
                });
            }
        }, 1500); // Faster mock
    }

    async hardReset() {
        console.log('[Fp Service] Executing DEEP HARD RESET...');
        this.lastStopTimestamp = Date.now(); // Mark as stopped now
        
        if (this.reader) {
            try {
                // Remove all listeners first
                this.reader.off('DeviceConnected', this.onDeviceConnected);
                this.reader.off('DeviceDisconnected', this.onDeviceDisconnected);
                this.reader.off('SamplesAcquired', this.onSamplesAcquired);
                this.reader.off('AcquisitionStarted', this.onAcquisitionStarted);
                this.reader.off('AcquisitionStopped', this.onAcquisitionStopped);
            } catch (e) {}
            
            try {
                // Try one last stop but don't wait for it to hang
                this.reader.stopAcquisition().catch(() => {});
            } catch (e) {}
            
            this.reader = null; 
        }

        // Reset all synchronization primitives
        if (this.stopResolver) {
            this.stopResolver();
            this.stopResolver = null;
        }
        this.stopPromise = null;

        this.initialized = false;
        this.isBusy = false;
        this.isCapturing = false;
        this.isStarting = false;
        this.cachedDevice = null;
        this.scanCallback = null;
        
        console.log('[Fp Service] Reader object destroyed and states cleared.');
    }

    /**
     * Centralized Similarity Algorithm for Fingerprint Templates (FMD/Base64)
     * Uses Sørensen–Dice coefficient with character Trigrams.
     * Trigrams (size 3) are much more specific than Bigrams for Base64 biometric data
     * and prevent false positives by significantly reducing random collisions.
     */
    calculateSimilarity(str1: string, str2: string): number {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 100;

        /**
         * ULTRA-PRECISION CLEANING
         * DigitalPersona FMD (Base64) headers can be large (up to 44+ chars).
         * we strip aggressively and normalize to avoid matching constant metadata.
         */
        const clean = (s: string) => {
            if (!s) return '';
            let target = s;
            
            // 1. Unwrap JSON if detected (for multi-capture scenarios)
            if (target.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(target);
                    if (parsed.Data) target = parsed.Data;
                    else if (parsed.samples && parsed.samples[0]?.Data) target = parsed.samples[0].Data;
                } catch (e) {}
            }

            // 2. Remove non-base64 characters
            const raw = target.replace(/[^A-Za-z0-9+/=]/g, '');
            
            // 3. AGGRESSIVE HEADER STRIPPING
            // DigitalPersona/ISO-FMD headers are typically 12-24 bytes (16-32 chars).
            // Stripping the first 16 chars helps bypass the constant metadata.
            return raw.length > 40 ? raw.substring(16) : raw;
        };

        const s1 = clean(str1);
        const s2 = clean(str2);

        // Debug Log in Console (Invisible to user, but useful for logs)
        if (s1.length < 30 || s2.length < 30) {
            console.log(`[Fp Matching] Critical: Template length too short after clean. S1: ${s1.length}, S2: ${s2.length}`);
            return 0;
        }

        // Score 0 if lengths are too divergent (structural mismatch)
        const avgLen = (s1.length + s2.length) / 2;
        const lenDiff = Math.abs(s1.length - s2.length);
        // Relaxed from 0.45 to 0.7 for better compatibility between different scan qualities
        if (lenDiff / avgLen > 0.7) return 0;

        // Generate sequences
        const getNGrams = (str: string, n: number) => {
            const ngrams = new Set<string>();
            for (let i = 0; i <= str.length - n; i++) {
                ngrams.add(str.substring(i, i + n));
            }
            return ngrams;
        };

        const calculateDice = (t1: Set<string>, t2: Set<string>) => {
            if (t1.size === 0 || t2.size === 0) return 0;
            let intersection = 0;
            t1.forEach(tri => { if (t2.has(tri)) intersection++; });
            return (2.0 * intersection) / (t1.size + t2.size) * 100;
        };

        // 1. High-Precision 5-Grams
        const t1_5 = getNGrams(s1, 5); 
        const t2_5 = getNGrams(s2, 5);
        const score5 = calculateDice(t1_5, t2_5);

        // 2. High-Recall 3-Grams
        const t1_3 = getNGrams(s1, 3);
        const t2_3 = getNGrams(s2, 3);
        const score3 = calculateDice(t1_3, t2_3);

        // Take the best of both, improved weighting (0.85) for fuzzy recall
        const finalScore = Math.max(score5, score3 * 0.85);

        if (finalScore > 5) {
            console.log(`[Fp Precision] Score: ${finalScore.toFixed(1)}% (5g:${score5.toFixed(1)}, 3g:${score3.toFixed(1)})`);
        }

        return finalScore;
    }

    /**
     * Helper to compare a single scan against a stored template (which may contain multiple samples)
     */
    calculateBestSimilarity(storedTemplate: string, currentScan: string): number {
        if (!storedTemplate || !currentScan) return 0;
        if (storedTemplate.includes('|||')) {
            const subTemplates = storedTemplate.split('|||');
            const scores = subTemplates.map(t => this.calculateSimilarity(t, currentScan));
            return Math.max(...scores);
        }
        return this.calculateSimilarity(storedTemplate, currentScan);
    }
}

export const fingerprint = new FingerprintService();
