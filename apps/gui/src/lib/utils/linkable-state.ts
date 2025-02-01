import { writable, type Writable } from 'svelte/store';

export interface LinkableState<T> extends Writable<T> {
  /**
   * Update or add a single parameter in the state.
   * @param param - The key in the state object.
   * @param value - The new value for that key.
   */
  setParam<K extends keyof T>(param: K, value: T[K]): void;
}

/**
 * Creates a store that is synchronized with the URL hash.
 *
 * The state is represented as an object and encoded as a base64 string in the URL hash.
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
      return JSON.parse(jsonString) as T;
    } catch (e) {
      console.warn('Failed to decode state from URL hash:', e);
      return defaultState;
    }
  }

  function encodeState(state: T): string {
    try {
      const jsonString = JSON.stringify(state);
      return '#' + btoa(jsonString);
    } catch (e) {
      console.warn('Failed to encode state into URL hash:', e);
      return '#';
    }
  }

  const initialState: T = decodeState(window.location.hash);

  const store = writable<T>(initialState);

  function updateUrl(state: T): void {
    const newHash = encodeState(state);
    history.pushState(null, '', newHash);
  }

  window.addEventListener('popstate', () => {
    const newState: T = decodeState(window.location.hash);
    store.set(newState);
  });

  return {
    subscribe: store.subscribe,
    set: (state: T) => {
      store.set(state);
      updateUrl(state);
    },
    update: (fn: (state: T) => T) => {
      store.update((current: T) => {
        const newState = fn(current);
        updateUrl(newState);
        return newState;
      });
    },
    setParam<K extends keyof T>(param: K, value: T[K]) {
      store.update((current: T) => {
        const newState = { ...current, [param]: value };
        updateUrl(newState);
        return newState;
      });
    }
  };
}
