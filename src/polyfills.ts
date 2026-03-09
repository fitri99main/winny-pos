// Polyfill for DigitalPersona WebSdk legacy dependencies
// This file MUST be the first import in main.tsx
// to guarantee definitions exist before the Vite pre-bundle imports WebSdk.

if (typeof window !== "undefined") {
    (window as any).ES6Promise = window.Promise;
    // Provide a placeholder for WebSdkCore that is expected by some parts of the library
    (window as any).WebSdkCore = (window as any).WebSdkCore || {
        WebSdk: { version: 4, port: 52181 },
        WebSdkEncryptionSupport: { None: 1, Encoding: 2, Encryption: 3, AESEncryption: 4 },
        WebSdkDataSupport: { Binary: 1, String: 2 },
        WebSdkOperationStatus: { Success: 0, Fail: 1 },
        log: (...args: any[]) => console.log('[WebSdkCore Mock]', ...args)
    };
}
