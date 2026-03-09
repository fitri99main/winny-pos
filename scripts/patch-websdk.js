#!/usr/bin/env node
/**
 * Patches @digitalpersona/websdk files to rename ALL occurrences of the word
 * "async" (used as a variable by the embedded caolan/async library) to
 * "_asyncLib". This prevents ReferenceError: async is not defined in ES modules.
 *
 * Run: node scripts/patch-websdk.js
 * Auto-runs via: npm install (postinstall hook in package.json)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToPatch = [
    'node_modules/@digitalpersona/websdk/dist/websdk.client.js',
    'node_modules/@digitalpersona/websdk/dist/websdk.client.ui.js',
    'node_modules/@digitalpersona/websdk/dist/websdk.client.min.js',
    'node_modules/@digitalpersona/websdk/dist/websdk.client.ui.min.js',
];

const MARKER = '/* PATCHED:async->_asyncLib */';

function patchFile(filePath) {
    const absPath = path.resolve(__dirname, '..', filePath);

    if (!fs.existsSync(absPath)) {
        console.log(`[patch-websdk] Skipping (not found): ${filePath}`);
        return;
    }

    let code = fs.readFileSync(absPath, 'utf8');

    // Remove old marker and re-patch if already patched (force re-apply)
    if (code.startsWith(MARKER + '\n')) {
        code = code.slice((MARKER + '\n').length);
    }

    if (!code.includes('var async = {}') && !code.includes('previous_async') && !code.includes('var _asyncLib')) {
        console.log(`[patch-websdk] No conflict found, skipping: ${filePath}`);
        return;
    }

    // Global word replacement: every standalone `async` identifier → `_asyncLib`
    // This file is pure ES5 (caolan/async embedded in WebSdk) — no native async/await
    // so replacing all \basync\b is safe and complete.
    const patched = code.replace(/\basync\b/g, '_asyncLib');

    fs.writeFileSync(absPath, MARKER + '\n' + patched, 'utf8');
    console.log(`[patch-websdk] ✓ Patched: ${filePath}`);
}

console.log('[patch-websdk] Patching @digitalpersona/websdk files...');
filesToPatch.forEach(patchFile);
console.log('[patch-websdk] Done.');
