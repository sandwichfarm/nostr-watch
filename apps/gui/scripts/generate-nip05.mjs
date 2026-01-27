#!/usr/bin/env node
/**
 * Generate NIP-05 nostr.json from operator configuration
 *
 * Usage: node scripts/generate-nip05.mjs
 *
 * This script reads config/nip05-operators.json and generates
 * static/.well-known/nostr.json in accordance with NIP-05.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/05.md
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONFIG_PATH = join(ROOT, 'config', 'nip05-operators.json');
const OUTPUT_PATH = join(ROOT, 'static', '.well-known', 'nostr.json');

function main() {
    console.log('Generating NIP-05 nostr.json...');

    // Read configuration
    let config;
    try {
        const configContent = readFileSync(CONFIG_PATH, 'utf-8');
        config = JSON.parse(configContent);
    } catch (err) {
        console.error(`Error reading config: ${err.message}`);
        process.exit(1);
    }

    const { operators, defaultRelays } = config;

    if (!operators || !Array.isArray(operators)) {
        console.error('Invalid config: operators must be an array');
        process.exit(1);
    }

    // Build NIP-05 compliant structure
    const names = {};
    const relays = {};

    for (const operator of operators) {
        const { name, pubkey, relays: operatorRelays } = operator;

        if (!name || !pubkey) {
            console.warn(`Skipping invalid operator entry: ${JSON.stringify(operator)}`);
            continue;
        }

        // Validate pubkey format (64 hex characters)
        if (!/^[a-f0-9]{64}$/i.test(pubkey)) {
            console.warn(`Skipping operator with invalid pubkey: ${name}`);
            continue;
        }

        // Add to names map
        names[name] = pubkey;

        // Add relays for this pubkey (operator-specific or default)
        const pubkeyRelays = operatorRelays || defaultRelays;
        if (pubkeyRelays && pubkeyRelays.length > 0) {
            relays[pubkey] = pubkeyRelays;
        }
    }

    // Create NIP-05 output
    const nostrJson = {
        names,
        relays
    };

    // Ensure output directory exists
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

    // Write output
    writeFileSync(OUTPUT_PATH, JSON.stringify(nostrJson, null, 2) + '\n');

    console.log(`Generated ${OUTPUT_PATH}`);
    console.log(`  - ${Object.keys(names).length} operators`);
    console.log(`  - ${Object.keys(relays).length} relay mappings`);
}

main();
