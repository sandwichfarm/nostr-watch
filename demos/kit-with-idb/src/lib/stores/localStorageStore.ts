import { get, writable } from 'svelte/store'

export function storable(key: string) {
   const store = writable({});
   const { subscribe, set } = store;
   const isBrowser = typeof window !== 'undefined';

   isBrowser &&
      localStorage[key] &&
      set(JSON.parse(localStorage[key]));

   return {
      subscribe,
      get: () => get(store),
      set: n => {
         isBrowser && (localStorage[key] = JSON.stringify(n));
         set(n);
      },
      update: cb => {
         const updatedStore = cb(get(store));

         isBrowser && (localStorage[key] = JSON.stringify(updatedStore));
         set(updatedStore);
      }
   };
}