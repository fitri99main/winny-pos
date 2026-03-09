#!/usr/bin/env node
/**
 * Patches @digitalpersona/websdk files to rename the legacy "async" variable
 * (from embedded caolan/async library) which conflicts with the ES module
 * reserved keyword `async`, causing: ReferenceError: async is not defined
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

    if (code.includes(MARKER)) {
        console.log(`[patch-websdk] Already patched: ${filePath}`);
        return;
    }

    if (!code.includes('var async = {}') && !code.includes('previous_async')) {
        console.log(`[patch-websdk] No conflict found, skipping: ${filePath}`);
        return;
    }

    const patched = code
        .replace(/\bvar async\s*=/g, 'var _asyncLib =')
        .replace(/\bprevious_async\b/g, '_previous_asyncLib')
        .replace(/\broot\.async\b/g, 'root._asyncLib')
        .replace(/\basync\./g, '_asyncLib.')
        .replace(/\breturn async;/g, 'return _asyncLib;')
        .replace(/\bmodule\.exports\s*=\s*async\b/g, 'module.exports = _asyncLib');

    fs.writeFileSync(absPath, MARKER + '\n' + patched, 'utf8');
    console.log(`[patch-websdk] ✓ Patched: ${filePath}`);
}

console.log('[patch-websdk] Patching @digitalpersona/websdk files...');
filesToPatch.forEach(patchFile);
console.log('[patch-websdk] Done.');
