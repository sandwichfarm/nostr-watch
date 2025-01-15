import N66 from '@nostrwatch/route66'

import DexieAdapter from '@nostrwatch/route66-cacheadapter-dexie'

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
// import N66 from '@nostrwatch/route66';
// import NostrToolsAdapter from 'adapters/websocket/NostrToolsAdapter/src/index';

// const websocketAdapter = new NostrToolsAdapter();
// const cacheAdapter = new IndexedDbAdapter();

// const relayUrls = [
//   'wss://relay.nostr.watch',
//   'wss://relaypag.es',
//   'wss://history.nostr.watch'
// ];

// const adapters = { websocketAdapter, cacheAdapter };

// const route66 = new N66(adapters, relayUrls);

// route66.initialize().then(async () => {
//   ////console.log('NIP-66 Library initialized for browser.');
//   const closestMonitor = await route66.findMonitorClosestToGeohash(
//     'u4pruydqqvj'
//   );
//   ////console.log('Closest Monitor:', closestMonitor);
//   const relaysByISP = await route66.findRelaysByISP('ISP1');
//   ////console.log('Relays by ISP:', relaysByISP);
// });
