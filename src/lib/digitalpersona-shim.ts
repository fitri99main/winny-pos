// src/lib/digitalpersona-shim.ts
/**
 * Shim to provide DigitalPersona globals as ESM exports.
 * These are loaded via script tags in index.html.
 */

const win = window as any;
const dp = win.dp || {};

// Devices re-exports
export const FingerprintReader = dp.devices?.FingerprintReader;
export const SampleFormat = dp.devices?.SampleFormat;
export const DeviceConnected = dp.devices?.DeviceConnected;
export const DeviceDisconnected = dp.devices?.DeviceDisconnected;
export const SamplesAcquired = dp.devices?.SamplesAcquired;
export const QualityReported = dp.devices?.QualityReported;
export const ErrorOccurred = dp.devices?.ErrorOccurred;
export const AcquisitionStarted = dp.devices?.AcquisitionStarted;
export const AcquisitionStopped = dp.devices?.AcquisitionStopped;

// Core re-exports
export const User = dp.core?.User;
export const BioSample = dp.core?.BioSample;
export const BioSampleFormat = dp.core?.BioSampleFormat;
export const BioSampleHeader = dp.core?.BioSampleHeader;
export const Credential = dp.core?.Credential;
export const Finger = dp.core?.Finger;
export const Ticket = dp.core?.Ticket;

// Services re-exports
export const EnrollService = dp.services?.EnrollService;
export const AuthService = dp.services?.AuthService;
export const ClaimsService = dp.services?.ClaimsService;
export const PolicyService = dp.services?.PolicyService;
export const SecretService = dp.services?.SecretService;

// WebSdk global
export const WebSdk = win.WebSdk;

// Combine everything for default export
const all = {
  ...(dp.core || {}),
  ...(dp.services || {}),
  ...(dp.devices || {}),
  WebSdk: win.WebSdk
};

export default all;
