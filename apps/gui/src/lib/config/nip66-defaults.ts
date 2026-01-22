/**
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

export const DEFAULT_NIP66_RELAYS: Nip66RelayConfig[] = [
    {
        "url": "wss://relay.nostr.watch",
        "description": "Primary nostr.watch relay",
        "isDefault": true,
        "enabled": true
    },
    {
        "url": "wss://relaypag.es",
        "description": "Relaypages NIP-66 relay",
        "isDefault": true,
        "enabled": true
    },
    {
        "url": "wss://monitorlizard.nostr1.com",
        "description": "Monitor Lizard relay",
        "isDefault": true,
        "enabled": true
    }
];

export const DEFAULT_NIP66_RELAY_URLS: string[] = [
    "wss://relay.nostr.watch",
    "wss://relaypag.es",
    "wss://monitorlizard.nostr1.com"
];
