import { writable, type Writable } from 'svelte/store';
import { liveQuery, relayDb, type INip11 } from '@nostrwatch/idb';
import { preferencesStore } from './preferencesStore';
import { storeKey } from '.';
// import { preferencesStore } from './preferencesStore';


export type Nip11Store = Writable<Map<string, INip11>>;

interface Nip11Interface {
  subscribe: Nip11Store['subscribe'];
  update: Nip11Store['update'];
  set: Nip11Store['set'];
  sync: (relay: string, monitorPubkey: string) => Promise<void>;
}

const nip11s = (): Nip11Interface => {
  const store: Nip11Store = writable(new Map());
  const { subscribe, update, set } = store;
  // let monitorPubkey: string | undefined;

  // preferencesStore.subscribe(preferences => {
  //   monitorPubkey = preferences.primaryMonitorPubkey;
  // });

  const sync = async (relay: string, monitorPubkey: string) => {
    const record = await relayDb.nip11s.where({ relay, monitorPubkey }).first();
    if (record) {
      update(store => store.set(storeKey(relay, monitorPubkey), record));
    }
  };

  return {
    subscribe,
    update,
    set,
    sync,
  };
};

let preferences;
preferencesStore.subscribe(_preferences => {
  preferences = _preferences;
});

const updateNip11s = (nip11s: INip11[]) => {
  nip11Store.update(store => {
    const updatedStore = new Map(store);
    nip11s.forEach(nip11 => {
      updatedStore.set(storeKey(nip11.relay, nip11.monitorPubkey), nip11);
    });
    return updatedStore;
  });
}

liveQuery( () => relayDb.nip11s.toArray() ).subscribe( updateNip11s );


export const nip11Store = nip11s();