#!/usr/bin/env node
/**
 * Patches @digitalpersona/websdk files to rename the legacy "async" variable
 * (from embedded caolan/async library) which conflicts with the ES module
 * reserved keyword `async`, causing: ReferenceError: async is not defined.
 * 
 * This version is targeted ONLY at the legacy UMD bundles.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const filesToPatch = [
    'node_modules/@digitalpersona/websdk/dist/websdk.client.js',
    'node_modules/@digitalpersona/websdk/dist/websdk.client.min.js',
    'node_modules/@digitalpersona/websdk/dist/websdk.client.ui.js',
    'node_modules/@digitalpersona/websdk/dist/websdk.client.ui.min.js'
];

const PATCH_MARKER = '/* PATCHED:async->_asyncLib */';

console.log('[patch-websdk] Running targeted patch for legacy WebSDK bundles...');

filesToPatch.forEach(relPath => {
    const fullPath = path.join(rootDir, relPath);

    if (!fs.existsSync(fullPath)) {
        console.warn(`[patch-websdk] File not found, skipping: ${relPath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');

    if (content.includes(PATCH_MARKER)) {
        console.log(`[patch-websdk] Already patched: ${relPath}`);
        return;
    }

    if (content.includes('var async = {}') || content.includes('previous_async')) {
        console.log(`[patch-websdk] Patching: ${relPath}`);

        // Globally replace word 'async' with '_asyncLib'
        // This is safe for these specific files as they are legacy UMD bundles
        // and do not contain modern 'async function' syntax.
        const patchedContent = content.replace(/\basync\b/g, '_asyncLib');

        fs.writeFileSync(fullPath, PATCH_MARKER + '\n' + patchedContent, 'utf8');
        console.log(`[patch-websdk] Success: ${relPath}`);
    } else {
        console.log(`[patch-websdk] No conflicting async pattern found in: ${relPath}`);
    }
});

console.log('[patch-websdk] Targeted patching done.');
