// src/lib/fingerprint.ts

import { FingerprintReader, SampleFormat, DeviceConnected, DeviceDisconnected, SamplesAcquired, AcquisitionStarted, AcquisitionStopped } from '@digitalpersona/devices';

/**
 * Utility Service untuk menghubungkan perangkat Fingerprint USB U.are.U 4500 (DigitalPersona / ZKTeco)
 * Beroperasi menggunakan official DigitalPersona Web SDK (@digitalpersona/devices).
 * Membutuhkan DigitalPersona Lite Client v2.1.1 atau HID Authentication Device Client sudah terinstal 
 * dan Service-nya berjalan di Windows.
 */

export interface FingerprintResult {
    success: boolean;
    template?: string; // Berisi Base64 string dari sidik jari
    message?: string;
    errorType?: 'NO_DEVICE' | 'SERVICE_NOT_RUNNING' | 'SCAN_FAILED' | 'UNKNOWN';
}

export type FingerprintCallback = (status: string, result?: FingerprintResult) => void;

class FingerprintService {
    private reader: FingerprintReader;
    private isCapturing = false;
    private isBusy = false; // Guard for SDK calls
    private scanCallback: FingerprintCallback | null = null;
    private currentMode: 'CAPTURE' | 'ENROLL' = 'CAPTURE';
    private cachedDevice: any = null;
    private busyTimeout: NodeJS.Timeout | null = null;
    private currentPort: number = 52181;
    private initialized: boolean = false;

    constructor() {
        // Delay initialization to startCapture where we can try ports
        this.reader = new FingerprintReader();
    }

    private initReader(port: number) {
        // Re-instantiate reader with specific port
        this.reader = new FingerprintReader({ port });
        this.currentPort = port;

        // Register event handlers
        this.reader.on('DeviceConnected', this.onDeviceConnected);
        this.reader.on('DeviceDisconnected', this.onDeviceDisconnected);
        this.reader.on('SamplesAcquired', this.onSamplesAcquired);
        this.reader.on('AcquisitionStarted', this.onAcquisitionStarted);
        this.reader.on('AcquisitionStopped', this.onAcquisitionStopped);
    }

    private onDeviceConnected = (event: DeviceConnected) => {
        console.log('DigitalPersona: Device Connected', event);
        if (this.scanCallback) {
            this.scanCallback('ALAT_TERDETEKSI');
        }
    };

    private onDeviceDisconnected = (event: DeviceDisconnected) => {
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

    private onAcquisitionStarted = (event: AcquisitionStarted) => {
        console.log('DigitalPersona: Acquisition Started');
        if (this.scanCallback) {
            this.scanCallback('WAITING_FOR_FINGER');
        }
    };

    private onAcquisitionStopped = (event: AcquisitionStopped) => {
        console.log('DigitalPersona: Acquisition Stopped');
        this.isCapturing = false;
        this.isBusy = false;
        if (this.busyTimeout) {
            clearTimeout(this.busyTimeout);
            this.busyTimeout = null;
        }
    };

    private onSamplesAcquired = (event: SamplesAcquired) => {
        console.log('DigitalPersona: Samples Acquired');
        if (!this.scanCallback) return;

        try {
            // Get the first sample and extract its Base64 data
            if (event.samples && event.samples.length > 0) {
                // The sample format depends on what we requested. Usually Intermediate/Raw or PngImage.
                // We'll use the raw base64 string provided by the SDK as our template.
                // Note: Real templating/matching requires @digitalpersona/services or a backend server.
                // For simplicity in this POS context, we use the base64 string provided.
                const sampleBase64 = event.samples[0].Data || event.samples[0];

                // Assuming it's a string, if it's an object we might need to stringify
                const template = typeof sampleBase64 === 'string' ? sampleBase64 : JSON.stringify(sampleBase64);

                console.log('DigitalPersona: Sample captured analysis:', {
                    length: template.length,
                    prefix: template.substring(0, 50),
                    isString: typeof sampleBase64 === 'string'
                });

                this.scanCallback('SUCCESS', {
                    success: true,
                    template: template,
                    message: this.currentMode === 'ENROLL' ? 'Sidik jari berhasil didaftarkan' : 'Sidik jari berhasil dibaca'
                });
            } else {
                console.warn('DigitalPersona: Samples acquired but quality is poor or empty');
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

    /**
     * Helper to wrap a promise with a timeout
     */
    private withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
        let timeoutHandle: NodeJS.Timeout;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        });

        return Promise.race([
            promise.then(result => {
                clearTimeout(timeoutHandle);
                return result;
            }),
            timeoutPromise
        ]);
    }

    /**
     * Force reset the busy state if something gets stuck
     */
    forceResetBusy() {
        console.log('DigitalPersona: Force resetting busy state');
        this.isBusy = false;
        if (this.busyTimeout) {
            clearTimeout(this.busyTimeout);
            this.busyTimeout = null;
        }
    }

    getCurrentPort() {
        return this.currentPort;
    }

    getServiceUrls() {
        return [
            { port: 52181, protocol: 'HTTP', url: 'http://127.0.0.1:52181/get_connection' },
            { port: 52182, protocol: 'HTTPS', url: 'https://127.0.0.1:52182/get_connection' },
            { port: 8080, protocol: 'HTTP', url: 'http://127.0.0.1:8080/DPBiotek/Fingerprint/Status' },
        ];
    }

    /**
     * Mengecek apakah layanan DigitalPersona berjalan.
     * Secara default SDK berjalan di port 52181 (HTTP) atau 52182 (HTTPS).
     */
    async checkServiceAvailability(): Promise<{ available: boolean; error?: string }> {
        try {
            if (!this.initialized) {
                // Trigger a dummy capture call to initialize (it will throw or succeed connection)
                // but better just use the logic directly
                const isHttps = window.location.protocol === 'https:';
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];
                let success = false;
                let lastError = "";

                console.log('DigitalPersona: Probing service availability...', { isHttps, portsToTry });

                for (const port of portsToTry) {
                    try {
                        this.initReader(port);
                        // Using a very short timeout for probing
                        await this.withTimeout(this.reader.enumerateDevices(), 2000, "Timeout");
                        success = true;
                        console.log(`DigitalPersona: Service found on port ${port}`);
                        break;
                    } catch (e: any) {
                        lastError = e?.message || "Unknown error";
                        console.warn(`DigitalPersona: Port ${port} probe failed: ${lastError}`);
                    }
                }
                if (!success) throw new Error(`Layanan tidak merespon: ${lastError}`);
                this.initialized = true;
            }
            return { available: true };
        } catch (err: any) {
            console.warn('DigitalPersona Service not responding');
            return {
                available: false,
                error: 'Service @digitalpersona/devices tidak merespon. Pastikan "DigitalPersona Biometric Service" berjalan.'
            };
        }
    }

    /**
     * Refreshes the cached device list
     */
    async refreshDevices() {
        try {
            const devices = await this.withTimeout(
                this.reader.enumerateDevices(),
                10000,
                'Refresh devices timed out'
            );
            if (devices.length > 0) {
                this.cachedDevice = devices[0];
                return devices;
            }
            this.cachedDevice = null;
            return [];
        } catch (err) {
            console.error('Error refreshing devices:', err);
            this.cachedDevice = null;
            return [];
        }
    }

    /**
     * Memulai proses tangkap sidik jari menggunakan Web SDK
     */
    async startCapture(onStatusUpdate: FingerprintCallback, mode: 'CAPTURE' | 'ENROLL' = 'CAPTURE') {
        if (this.isCapturing) return;

        this.scanCallback = onStatusUpdate;
        this.currentMode = mode;

        if (this.isBusy) {
            console.warn('DigitalPersona: Service is busy.');
            if (!this.busyTimeout) this.isBusy = false; // Reset if no active timeout
            else {
                onStatusUpdate('ERROR', { success: false, message: 'Alat sedang sibuk.', errorType: 'UNKNOWN' });
                return;
            }
        }

        console.log('DigitalPersona: startCapture requested', { mode, currentPort: this.currentPort });

        // Global timeout for the entire capture process (20 seconds) 
        // to prevent perpetual loading if SDK or browser hangs
        const globalTimeout = setTimeout(() => {
            if (this.isBusy && !this.isCapturing) {
                console.error('DigitalPersona: GLOBAL TIMEOUT triggered');
                this.isBusy = false;
                onStatusUpdate('ERROR', {
                    success: false,
                    message: 'Gagal menghubungkan ke scanner (Service Timeout). Mohon gunakan link diagnosa di bawah.',
                    errorType: 'SERVICE_NOT_RUNNING'
                });
            }
        }, 20000);

        try {
            this.isBusy = true;
            onStatusUpdate('Menghubungkan...');

            // 1. Initialize Service Connection (Port Negotiation)
            if (!this.initialized) {
                const isHttps = window.location.protocol === 'https:';
                const portsToTry = isHttps ? [52182, 52181] : [52181, 52182];

                let success = false;
                for (const port of portsToTry) {
                    try {
                        onStatusUpdate(`Mengecek Port ${port}...`);
                        console.log(`DigitalPersona: Trying Port ${port}...`);
                        this.initReader(port);

                        // Short timeout for port probing
                        await this.withTimeout(this.reader.enumerateDevices(), 4000, `Timeout di Port ${port}`);

                        console.log(`DigitalPersona: Connected via Port ${port}`);
                        success = true;
                        break;
                    } catch (e: any) {
                        console.warn(`DigitalPersona: Port ${port} failed: ${e.message}`);
                    }
                }

                if (!success) {
                    throw new Error("Layanan biometrik tidak merespon (Gunakan link bantuan di bawah untuk verifikasi).");
                }
                this.initialized = true;
            }

            // 2. Get Device
            let device = this.cachedDevice;
            if (!device) {
                onStatusUpdate('Mencari Alat...');
                const devices = await this.withTimeout(
                    this.reader.enumerateDevices(),
                    10000,
                    'Gagal mendeteksi alat (Service Timeout). Pastikan service DigitalPersona berjalan.'
                );

                if (devices.length === 0) {
                    onStatusUpdate('ERROR', {
                        success: false,
                        message: 'Alat fingerprint tidak terdeteksi. Silakan cabut dan pasang kembali USB.',
                        errorType: 'NO_DEVICE'
                    });
                    this.isBusy = false;
                    return;
                }
                device = devices[0];
                this.cachedDevice = device;
            }

            // 3. Start Acquisition
            onStatusUpdate('Menyiapkan Scanner...');
            await this.withTimeout(
                this.reader.startAcquisition(SampleFormat.Intermediate, device),
                10000,
                'Gagal memulai pemindaian (Timeout).'
            );

            clearTimeout(globalTimeout);
            this.isCapturing = true;
            this.isBusy = false;
            console.log('DigitalPersona: Capture started successfully');

        } catch (err: any) {
            clearTimeout(globalTimeout);
            console.error('Failed to start capture:', err);
            this.isBusy = false;
            this.isCapturing = false;

            onStatusUpdate('ERROR', {
                success: false,
                message: err.message || 'Gagal inisialisasi hardware.',
                errorType: 'SERVICE_NOT_RUNNING'
            });
        }
    }

    /**
     * Membatalkan proses scan
     */
    async stopCapture() {
        if (this.isCapturing) {
            try {
                // Adding a 3-second timeout to stopAcquisition
                await this.withTimeout(
                    this.reader.stopAcquisition(),
                    3000,
                    'DigitalPersona acquisition stop timed out'
                );
            } catch (err) {
                console.warn('Error stopping acquisition', err);
            } finally {
                this.isBusy = false;
            }
        }
        this.isCapturing = false;
        this.scanCallback = null;
    }

    /**
     * [MOCK] Untuk Development Test jika alat fisik/client tidak ada
     */
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
