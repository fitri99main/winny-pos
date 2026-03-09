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
        if (this.isCapturing && this.scanCallback) {
            this.scanCallback('ERROR', {
                success: false,
                message: 'Alat fingerprint terputus. Pastikan kabel USB terpasang dengan kuat.',
                errorType: 'NO_DEVICE'
            });
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
                const sampleBase64 = event.samples[0].Data || event.samples[0];
                const template = typeof sampleBase64 === 'string' ? sampleBase64 : JSON.stringify(sampleBase64);
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
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];
                let success = false;
                let lastError = '';
                for (const port of portsToTry) {
                    try {
                        await this.initReader(port);
                        await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 2000, 'Timeout');
                        success = true;
                        break;
                    } catch (e: any) {
                        lastError = e?.message || 'Unknown error';
                    }
                }
                if (!success) throw new Error(`Layanan tidak merespon: ${lastError}`);
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
        }, 20000);

        try {
            this.isBusy = true;
            onStatusUpdate('Menghubungkan...');

            if (!this.initialized) {
                const modules = await this.loadDevicesModule();
                const { SampleFormat } = modules;
                const isHttps = window.location.protocol === 'https:';
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];
                let success = false;
                for (const port of portsToTry) {
                    try {
                        onStatusUpdate(`Mengecek Port ${port}...`);
                        await this.initReader(port);
                        await this.withTimeout(this.reader.enumerateDevices() as Promise<any[]>, 4000, `Timeout di Port ${port}`);
                        success = true;
                        break;
                    } catch (e: any) {
                        console.warn(`DigitalPersona: Port ${port} failed: ${e.message}`);
                    }
                }
                if (!success) throw new Error('Layanan biometrik tidak merespon.');
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
        if (this.isCapturing) {
            try {
                await this.withTimeout(this.reader.stopAcquisition(), 3000, 'Stop acquisition timed out');
            } catch (err) {
                console.warn('Error stopping acquisition', err);
            } finally {
                this.isBusy = false;
            }
        }
        this.isCapturing = false;
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
}

export const fingerprint = new FingerprintService();
