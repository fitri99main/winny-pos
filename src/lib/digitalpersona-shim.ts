// src/lib/digitalpersona-shim.ts
/**
 * Shim to provide DigitalPersona globals as ESM exports.
 * These are loaded via script tags in index.html to bypass Vite bundling issues.
 */

const win = window as any;

// WebSdk global
export const WebSdk = win.WebSdk;

// dp core globals
export const core = win.dp?.core;
export const devices = win.dp?.devices;
export const services = win.dp?.services;

// Default export to support various import styles
export default {
  core,
  devices,
  services,
  WebSdk
};
