import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { NostrFetcher, normalizeRelayUrlSet } from 'nostr-fetch';
import { ndkAdapter } from '@nostr-fetch/adapter-ndk';
import { nHoursAgo } from '$lib/utils';
import { NDKRelayMeta } from '$lib/relays/relay-meta';
import { NDKEventGeoCoded } from '$lib/relays/geocoded'
import type { RelayMetaParsedAll } from '$lib/relays/relay-meta';

export type Result = {
  data: any,
  duration: number
}

export type RttResult = {
  open: Result,
  read?: Result,
  write?: Result
}

export type RelayData = RelayMetaParsedAll

export class RelayFetcher {
  private readonly MONITOR: string = "9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923";
  private dataRelays: string[];
  private ndk: NDK
  relayData: Map<string, RelayData> = new Map();
  relayEvents: Map<string, NDKRelayMeta> = new Map();

  constructor(){
    this.dataRelays = [
      "wss://history.nostr.watch",
      "wss://relaypag.es"
    ]
    this.ndk = new NDK({ 
      // cacheAdapter: new NDKCacheAdapterDexie({ dbName: 'ndk' }),
      explicitRelayUrls: normalizeRelayUrlSet(this.dataRelays) 
    });
  }

  async fetch( cb: (url: string, meta: RelayData ) => {} ){
    await this.ndk.connect()
    console.log('connected')
    const fetcher = NostrFetcher.withCustomPool(ndkAdapter(this.ndk));
    // const fetcher = NostrFetcher.init()
    const postIter = fetcher.allEventsIterator(
        this.dataRelays,
        { kinds: [ 30066 ], authors: [ this.MONITOR ] },
        { since: nHoursAgo(2) },
        { skipVerification: true }
    );
    console.log('awaiting')
    let count = 0
    for await (const ev of postIter) {
      const event: NDKRelayMeta = new NDKRelayMeta(this.ndk, ev)
      const relay = ev.tags.find( tag => tag[0] === "d" )?.[1]
      if(!relay) continue;
      try {
        cb(relay, event.all)
      } catch(e){
        throw e
      }
      
    };
  }

  get keys(){
    return this.relayData.keys()
  }

  sortByDistance( geohash: string ): Set<NDKEvent> | undefined {
    if(this?.relayEvents) return
    return NDKEventGeoCoded.sortGeospatial(geohash, new Set(this.relayEvents.values()))
  }
}