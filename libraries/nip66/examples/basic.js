
import nip66 from '../src/index';
import NostrToolsAdapter from 'adapters/websocket/NostrToolsAdapter/src';
import IndexedDbAdapter from 'adapters/cache/IndexedDbAdapter/src';

const websocketAdapter = new NostrToolsAdapter();
const cacheAdapter = new IndexedDbAdapter();

const relayUrls = [
  'wss://relay.nostr.watch',
  'wss://relaypag.es',
  'wss://history.nostr.watch'
];

const nip66 = new NIP66Library(websocketAdapter, cacheAdapter, relayUrls);

nip66.initialize().then(async () => {
  console.log('NIP-66 Library initialized for browser.');
  const closestMonitor = await nip66.findMonitorClosestToGeohash(
    'u4pruydqqvj'
  );
  console.log('Closest Monitor:', closestMonitor);
  const relaysByISP = await nip66.findRelaysByISP('ISP1');
  console.log('Relays by ISP:', relaysByISP);
});