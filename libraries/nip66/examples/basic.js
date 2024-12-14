import N66 from '@nostrwatch/nip66'

import DexieAdapter from '@nostrwatch/nip66-cacheadapter-dexie'

const n66 = new N66()

// Initialize the library
n66.init()
  .then(() => {
    ////console.log('NIP-66 initialized successfully.')
  })
  .catch(err => {
    console.error('Initialization failed:', err)
  })

////console.log('DexieAdapter:', DexieAdapter)
// import N66 from '@nostrwatch/nip66';
// import NostrToolsAdapter from 'adapters/websocket/NostrToolsAdapter/src/index';

// const websocketAdapter = new NostrToolsAdapter();
// const cacheAdapter = new IndexedDbAdapter();

// const relayUrls = [
//   'wss://relay.nostr.watch',
//   'wss://relaypag.es',
//   'wss://history.nostr.watch'
// ];

// const adapters = { websocketAdapter, cacheAdapter };

// const nip66 = new N66(adapters, relayUrls);

// nip66.initialize().then(async () => {
//   ////console.log('NIP-66 Library initialized for browser.');
//   const closestMonitor = await nip66.findMonitorClosestToGeohash(
//     'u4pruydqqvj'
//   );
//   ////console.log('Closest Monitor:', closestMonitor);
//   const relaysByISP = await nip66.findRelaysByISP('ISP1');
//   ////console.log('Relays by ISP:', relaysByISP);
// });
