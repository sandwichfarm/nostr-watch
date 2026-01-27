#!/usr/bin/env node
/**
 * Generate NIP-66 relay configuration for build-time seeding
 *
 * Usage: node scripts/generate-nip66-config.mjs
 *
 * This script reads config/nip66-relays.json and generates
 * a TypeScript module that exports the default relays.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONFIG_PATH = join(ROOT, 'config', 'nip66-relays.json');
const OUTPUT_PATH = join(ROOT, 'src', 'lib', 'config', 'nip66-defaults.ts');

function main() {
    console.log('Generating NIP-66 relay defaults...');

    // Read configuration
    let config;
    try {
        const configContent = readFileSync(CONFIG_PATH, 'utf-8');
        config = JSON.parse(configContent);
    } catch (err) {
        console.error(`Error reading config: ${err.message}`);
        process.exit(1);
    }

    const { relays } = config;

    if (!relays || !Array.isArray(relays)) {
        console.error('Invalid config: relays must be an array');
        process.exit(1);
    }

    // Validate relay URLs
    const validRelays = relays.filter(relay => {
        if (!relay.url) {
            console.warn(`Skipping relay without URL: ${JSON.stringify(relay)}`);
            return false;
        }
        try {
            const url = new URL(relay.url);
            if (!['ws:', 'wss:'].includes(url.protocol)) {
                console.warn(`Skipping relay with invalid protocol: ${relay.url}`);
                return false;
            }
            return true;
        } catch {
            console.warn(`Skipping relay with invalid URL: ${relay.url}`);
            return false;
        }
    });

    // Generate TypeScript output
    const output = `/**
 * Default NIP-66 relays - AUTO-GENERATED, DO NOT EDIT
 * Generated from config/nip66-relays.json
 * Run: pnpm run nip66:config
 */

export interface Nip66RelayConfig {
    url: string;
    description?: string;
    isDefault: boolean;
    enabled: boolean;
}

export const DEFAULT_NIP66_RELAYS: Nip66RelayConfig[] = ${JSON.stringify(
        validRelays.map(r => ({
            url: r.url,
            description: r.description || undefined,
            isDefault: true,
            enabled: true
        })),
        null,
        4
    )};

export const DEFAULT_NIP66_RELAY_URLS: string[] = ${JSON.stringify(
        validRelays.map(r => r.url),
        null,
        4
    )};
`;

    // Ensure output directory exists
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

    // Write output
    writeFileSync(OUTPUT_PATH, output);

    console.log(`Generated ${OUTPUT_PATH}`);
    console.log(`  - ${validRelays.length} default relays`);
}

main();
