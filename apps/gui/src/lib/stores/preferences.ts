/**
 * App Preferences Store
 *
 * Manages user preferences that persist to localStorage.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'nostrwatch:preferences';

export interface AppPreferences {
    showDebugButton: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
    showDebugButton: false
};

function loadPreferences(): AppPreferences {
    if (!browser) return { ...DEFAULT_PREFERENCES };

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_PREFERENCES, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load preferences:', e);
    }

    return { ...DEFAULT_PREFERENCES };
}

function createPreferencesStore() {
    const { subscribe, set, update } = writable<AppPreferences>(loadPreferences());

    // Persist to localStorage on changes
    if (browser) {
        subscribe(prefs => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
            } catch (e) {
                console.warn('Failed to persist preferences:', e);
            }
        });
    }

    return {
        subscribe,

        setShowDebugButton(value: boolean) {
            update(p => ({ ...p, showDebugButton: value }));
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
