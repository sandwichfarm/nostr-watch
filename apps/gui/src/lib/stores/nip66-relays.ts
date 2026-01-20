/**
 * NIP-66 Relay Configuration Store
 *
 * Manages the list of NIP-66 relays used to fetch relay metadata.
 * - Default relays (from build config) cannot be removed but can be disabled
 * - User can add custom relays which can be removed
 * - At least one relay must be enabled at all times
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { DEFAULT_NIP66_RELAYS, type Nip66RelayConfig } from '$lib/config/nip66-defaults';

const STORAGE_KEY = 'nostrwatch:nip66-relays';

export interface Nip66RelayState {
    relays: Nip66RelayConfig[];
}

function createInitialState(): Nip66RelayState {
    // Start with defaults
    const state: Nip66RelayState = {
        relays: [...DEFAULT_NIP66_RELAYS]
    };

    // Load user customizations from localStorage
    if (browser) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Nip66RelayState;

                // Merge: keep all defaults, apply enabled state from storage
                const storedUrlMap = new Map(
                    parsed.relays.map(r => [r.url, r])
                );

                // Update default relays with stored enabled state
                state.relays = DEFAULT_NIP66_RELAYS.map(defaultRelay => {
                    const stored = storedUrlMap.get(defaultRelay.url);
                    return {
                        ...defaultRelay,
                        enabled: stored?.enabled ?? defaultRelay.enabled
                    };
                });

                // Add any custom (non-default) relays from storage
                for (const storedRelay of parsed.relays) {
                    if (!storedRelay.isDefault) {
                        state.relays.push(storedRelay);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load NIP-66 relay config from storage:', e);
        }
    }

    return state;
}

function createNip66RelaysStore() {
    const { subscribe, set, update } = writable<Nip66RelayState>(createInitialState());

    // Persist to localStorage on changes
    if (browser) {
        subscribe(state => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.warn('Failed to persist NIP-66 relay config:', e);
            }
        });
    }

    return {
        subscribe,

        /**
         * Add a custom relay
         */
        addRelay(url: string, description?: string): { success: boolean; error?: string } {
            // Validate URL
            try {
                const parsed = new URL(url);
                if (!['ws:', 'wss:'].includes(parsed.protocol)) {
                    return { success: false, error: 'URL must use ws:// or wss:// protocol' };
                }
                // Normalize URL (remove trailing slash)
                url = parsed.href.replace(/\/$/, '');
            } catch {
                return { success: false, error: 'Invalid URL format' };
            }

            const state = get({ subscribe });

            // Check for duplicates
            if (state.relays.some(r => r.url === url)) {
                return { success: false, error: 'Relay already exists' };
            }

            update(s => ({
                relays: [
                    ...s.relays,
                    {
                        url,
                        description,
                        isDefault: false,
                        enabled: true
                    }
                ]
            }));

            return { success: true };
        },

        /**
         * Remove a custom relay (cannot remove default relays)
         */
        removeRelay(url: string): { success: boolean; error?: string } {
            const state = get({ subscribe });
            const relay = state.relays.find(r => r.url === url);

            if (!relay) {
                return { success: false, error: 'Relay not found' };
            }

            if (relay.isDefault) {
                return { success: false, error: 'Cannot remove default relays. You can disable them instead.' };
            }

            // Check if this would leave no enabled relays
            const remainingEnabled = state.relays.filter(
                r => r.url !== url && r.enabled
            );
            if (remainingEnabled.length === 0) {
                return { success: false, error: 'Cannot remove: at least one relay must remain enabled' };
            }

            update(s => ({
                relays: s.relays.filter(r => r.url !== url)
            }));

            return { success: true };
        },

        /**
         * Toggle relay enabled state
         */
        toggleRelay(url: string): { success: boolean; error?: string } {
            const state = get({ subscribe });
            const relay = state.relays.find(r => r.url === url);

            if (!relay) {
                return { success: false, error: 'Relay not found' };
            }

            // If disabling, check we'd still have at least one enabled
            if (relay.enabled) {
                const wouldRemainEnabled = state.relays.filter(
                    r => r.url !== url && r.enabled
                );
                if (wouldRemainEnabled.length === 0) {
                    return { success: false, error: 'Cannot disable: at least one relay must remain enabled' };
                }
            }

            update(s => ({
                relays: s.relays.map(r =>
                    r.url === url ? { ...r, enabled: !r.enabled } : r
                )
            }));

            return { success: true };
        },

        /**
         * Set relay enabled state explicitly
         */
        setRelayEnabled(url: string, enabled: boolean): { success: boolean; error?: string } {
            const state = get({ subscribe });
            const relay = state.relays.find(r => r.url === url);

            if (!relay) {
                return { success: false, error: 'Relay not found' };
            }

            // If disabling, check we'd still have at least one enabled
            if (!enabled && relay.enabled) {
                const wouldRemainEnabled = state.relays.filter(
                    r => r.url !== url && r.enabled
                );
                if (wouldRemainEnabled.length === 0) {
                    return { success: false, error: 'Cannot disable: at least one relay must remain enabled' };
                }
            }

            update(s => ({
                relays: s.relays.map(r =>
                    r.url === url ? { ...r, enabled } : r
                )
            }));

            return { success: true };
        },

        /**
         * Reset to defaults (removes custom relays, enables all defaults)
         */
        reset() {
            set({
                relays: DEFAULT_NIP66_RELAYS.map(r => ({ ...r, enabled: true }))
            });
        }
    };
}

export const nip66RelaysStore = createNip66RelaysStore();

// Derived stores for convenience
export const nip66Relays = derived(nip66RelaysStore, $store => $store.relays);
export const enabledNip66Relays = derived(nip66RelaysStore, $store =>
    $store.relays.filter(r => r.enabled)
);
export const enabledNip66RelayUrls = derived(enabledNip66Relays, $relays =>
    $relays.map(r => r.url)
);
