import { derived, type Readable } from 'svelte/store';

export function throttledDerived<T, U>(
  stores: Readable<T> | Readable<T>[],
  callback: (value: T | T[], lastValue: U | undefined) => U,
  interval: number = 1000
): Readable<U> {
  let lastValue: U | undefined;
  let lastEmitTime = 0;
  let pendingValue: U | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return derived(stores, (values, set) => {
    const now = Date.now();
    const newValue = callback(values, lastValue);

    if (now - lastEmitTime >= interval) {
      lastEmitTime = now;
      lastValue = newValue;
      set(newValue);

      pendingValue = undefined;
    } else {
      pendingValue = newValue;

      if (!timeoutId) {
        const delay = interval - (now - lastEmitTime);
        timeoutId = setTimeout(() => {
          lastEmitTime = Date.now();
          if (pendingValue !== undefined) {
            lastValue = pendingValue;
            set(pendingValue);
            pendingValue = undefined;
          }
          timeoutId = null;
        }, delay);
      }
    }
  });
}
