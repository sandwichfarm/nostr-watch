/**
 * App Preferences Store
 *
 * Manages user preferences that persist to localStorage.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { tabState } from './app';
import { getLeaderTabRpcClient } from '$lib/runtime/leader-tab-client';
import { leaderRpcCall } from '$lib/runtime/leader-tab-rpc';
import {
    installConsoleLogLevelFilter,
    normalizeLogLevel,
    setGlobalLogLevel,
    type LogLevel
} from '@nostrwatch/utils';

const STORAGE_KEY = 'nostrwatch:preferences';

export interface AppPreferences {
    showDebugButton: boolean;
    logLevel: LogLevel;
}

const DEFAULT_PREFERENCES: AppPreferences = {
    showDebugButton: false,
    logLevel: 'warn'
};

function normalizePreferences(value: unknown): AppPreferences {
    if (!value || typeof value !== 'object') return { ...DEFAULT_PREFERENCES };
    const raw = value as Partial<AppPreferences>;
    return {
        ...DEFAULT_PREFERENCES,
        ...raw,
        showDebugButton: Boolean(raw.showDebugButton),
        logLevel: normalizeLogLevel((raw as any).logLevel, DEFAULT_PREFERENCES.logLevel)
    };
}

function loadPreferences(): AppPreferences {
    if (!browser) return { ...DEFAULT_PREFERENCES };

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return normalizePreferences(parsed);
        }
    } catch (e) {
        console.warn('Failed to load preferences:', e);
    }

    return { ...DEFAULT_PREFERENCES };
}

function createPreferencesStore() {
    const initial = loadPreferences();
    const { subscribe, set, update } = writable<AppPreferences>(initial);

    const applyLogLevel = (prefs: AppPreferences) => {
        try {
            setGlobalLogLevel(prefs.logLevel);
            installConsoleLogLevelFilter();
            window.dispatchEvent(new CustomEvent('nostrwatch:loglevel', { detail: prefs.logLevel }));
        } catch {}
    };

    // Persist to localStorage on changes
    if (browser) {
        let suppressPersist = false;
        let isInitial = true;

        const applyRemote = (next: AppPreferences) => {
            suppressPersist = true;
            set(next);
            suppressPersist = false;
        };

        subscribe((prefs) => {
            applyLogLevel(prefs);
            if (suppressPersist) return;
            if (isInitial) {
                isInitial = false;
                return;
            }

            const role = get(tabState);
            if (role === 'leader') {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
                } catch (e) {
                    console.warn('Failed to persist preferences:', e);
                }
                try {
                    getLeaderTabRpcClient().broadcast('state.localStorage', { key: STORAGE_KEY, value: prefs });
                } catch {}
                return;
            }

            void leaderRpcCall('state.localStorageSet', [STORAGE_KEY, prefs], { timeoutMs: 5_000 }).catch(() => {
                // Best-effort fallback: persist locally if leader RPC is unavailable.
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
                } catch {}
            });
        });

        window.addEventListener('storage', (event) => {
            if (event.key !== STORAGE_KEY) return;
            if (typeof event.newValue !== 'string') {
                applyRemote({ ...DEFAULT_PREFERENCES });
                return;
            }
            try {
                applyRemote(normalizePreferences(JSON.parse(event.newValue)));
            } catch {
                applyRemote({ ...DEFAULT_PREFERENCES });
            }
        });

        try {
            getLeaderTabRpcClient().onBroadcast((msg) => {
                if (msg.kind !== 'state.localStorage') return;
                const data = msg.data as any;
                if (data?.key !== STORAGE_KEY) return;
                applyRemote(normalizePreferences(data?.value));
            });
        } catch {}
    }

    return {
        subscribe,

        setShowDebugButton(value: boolean) {
            update(p => ({ ...p, showDebugButton: value }));
        },

        setLogLevel(value: LogLevel) {
            update(p => ({ ...p, logLevel: value }));
        },

        reset() {
            set({ ...DEFAULT_PREFERENCES });
        }
    };
}

export const preferences = createPreferencesStore();

// Convenience derived values
export const showDebugButton = {
    subscribe: (fn: (value: boolean) => void) => {
        return preferences.subscribe(p => fn(p.showDebugButton));
    }
};

export const logLevel = {
    subscribe: (fn: (value: LogLevel) => void) => {
        return preferences.subscribe(p => fn(p.logLevel));
    }
};
