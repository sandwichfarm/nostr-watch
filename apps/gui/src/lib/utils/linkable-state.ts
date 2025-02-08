import { pushState } from '$app/navigation';
import { compress, decompress } from 'compress-json';
import { derived, get, writable, type Readable, type Writable } from 'svelte/store';

export interface LinkableState<T> extends Writable<T> {
  /**
   * Update or add a single parameter in the state.
   * @param param - The key in the state object.
   * @param value - The new value for that key.
   */
  setParam<K extends keyof T>(param: K, value: T[K]): void;
  // Expose the underlying store if needed.
  store: Writable<T>;
  // Returns the current state encoded as a hash.
  hash(activeKeys?: Writable<string[]>): Readable<string> ;
}

/**
 * Creates a store that is synchronized with the URL hash.
 *
 * On initialization, if a decodable hash is present it is decoded into the store,
 * and then the hash is removed from the URL.
 *
 * The state is represented as an object and encoded as a base64 string (with optional compression)
 * in the URL hash.
 *
 * @param defaultState - The default state object.
 * @returns A Svelte store bound to the URL hash.
 */
export function linkableState<T extends object>(defaultState: T): LinkableState<T> {
  function decodeState(hash: string): T {
    if (!hash) return defaultState;
    if (hash.startsWith('#')) hash = hash.slice(1);
    try {
      const jsonString = atob(hash);
      const parsed = JSON.parse(jsonString);
      try {
        return decompress(parsed) as T;
      } catch (decompressError) {
        console.warn('Decompression failed, returning parsed state instead:', decompressError);
        return parsed as T;
      }
    } catch (e) {
      console.warn('Failed to decode state from URL hash:', e);
      return defaultState;
    }
  }

  function encodeState(state: T, activeKeys?: string[]): string {
    try {
      if(activeKeys) {
        const newState = {...state};
        for(const key in newState) {
          if(!activeKeys.includes(key)) {
            delete newState[key];
          }
        }
        state = newState;
      }
      const compressed = compress(state);
      const jsonString = JSON.stringify(compressed);
      return '#' + btoa(jsonString);
    } catch (e) {
      console.warn('Failed to encode state into URL hash:', e);
      return '#';
    }
  }

  let currentHash = window.location.hash;
  const initialState: T = decodeState(currentHash);
  const store = writable<T>(initialState);

  // If a hash was present on page load, remove it from the URL.
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  window.addEventListener('popstate', () => {
    const newState: T = decodeState(window.location.hash);
    store.set(newState);
  });

  return {
    subscribe: store.subscribe,
    set: (state: T) => {
      store.set(state);
    },
    update: (fn: (state: T) => T) => {
      store.update((current: T) => {
        const newState = fn(current);
        return newState;
      });
    },
    setParam<K extends keyof T>(param: K, value: T[K]) {
      store.update((current: T) => {
        const newState = { ...current, [param]: value };
        return newState;
      });
    },
    hash: (activeKeys: Writable<string[]>): Readable<string> => {
      return derived([store, activeKeys], ([state, $activeKeys]) => encodeState(state, $activeKeys));
    },
    store
  };
}
