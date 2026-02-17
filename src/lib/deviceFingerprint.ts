/**
 * Device Fingerprint Generator
 * Creates a unique identifier for each device/browser combination
 */

export function generateDeviceFingerprint(): string {
    try {
        const components = [
            navigator.userAgent,
            navigator.language,
            `${screen.width}x${screen.height}`,
            `${screen.colorDepth}`,
            new Date().getTimezoneOffset().toString(),
            navigator.hardwareConcurrency?.toString() || 'unknown',
            navigator.platform,
        ];

        // Create a hash-like string from components
        const fingerprint = btoa(components.join('|'));

        // Store in localStorage for consistency across page reloads
        localStorage.setItem('device_fingerprint', fingerprint);

        return fingerprint;
    } catch (error) {
        console.error('Error generating device fingerprint:', error);
        // Fallback to a random ID stored in localStorage
        let fallback = localStorage.getItem('device_fingerprint');
        if (!fallback) {
            fallback = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('device_fingerprint', fallback);
        }
        return fallback;
    }
}

export function getDeviceFingerprint(): string {
    // Try to get from localStorage first for consistency
    const stored = localStorage.getItem('device_fingerprint');
    if (stored) return stored;

    // Generate new if not found
    return generateDeviceFingerprint();
}

export function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        timestamp: new Date().toISOString(),
    };
}

export function clearDeviceFingerprint() {
    localStorage.removeItem('device_fingerprint');
}
