import { NDKEvent, NDKRelayDiscovery, NDKRelayMeta, NDKRelayMonitor } from "@nostr-dev-kit/ndk";
import { MonitorFetcherOptionsDefaults } from "./fetchers/monitor-fetcher";
import { MonitorRelayFetcher, RelayMonitorSetExt } from "./fetchers/monitor-relay-fetcher";
import { NDKKind } from "@nostr-dev-kit/ndk";

type GenericObject = { [key: string]: any };

export const popProp = (obj: GenericObject, ...props: string[]) => {
  const result: GenericObject = {};
  for (const prop of props) {
    if (prop in obj) {
      result[prop] = obj[prop];
      delete obj[prop];
    }
  }
  return result;
}

export const castSet = (ndkEvents: Set<NDKEvent>): Set<NDKRelayMonitor | NDKRelayDiscovery | NDKRelayMeta | undefined | null> => {
  const arr = Array.from(ndkEvents);
  const newarr: (NDKRelayMonitor | NDKRelayDiscovery | NDKRelayMeta | undefined | null)[] = arr.map( (event: NDKEvent) => {
    if(event.kind === NDKKind.RelayMonitor) {
      return NDKRelayMonitor.from(event);
    }
    if(event.kind === NDKKind.RelayDiscovery) {
      return NDKRelayDiscovery.from(event);
    }
    if(event.kind === NDKKind.RelayMeta) {
      return NDKRelayMeta.from(event);
    }
  });

  return new Set<NDKRelayMonitor | NDKRelayDiscovery | NDKRelayMeta | null | undefined>(newarr)
}

export const castSetRelayMonitorFetchers = (ndkEvents: Set<NDKEvent>): Set<MonitorRelayFetcher> | undefined  => {
  const arr = Array.from(ndkEvents);
  if(!arr.length) return
  const newarr: (MonitorRelayFetcher | undefined)[] = arr.map( (event: NDKEvent) => {
      // if(event.kind === NDKKind.RelayMonitor) {
        return new MonitorRelayFetcher(event.ndk, event.rawEvent());
      // }
    })

  console.log('newarr', newarr)
    // .filter( (event: MonitorRelayFetcher | undefined) => {
    //   typeof event !== 'undefined'
    // })
  return new Set(newarr as MonitorRelayFetcher[])
}

export const castSetRelayMetas = (ndkEvents: Set<NDKEvent>): Set<NDKRelayDiscovery | undefined>  => {
  const arr = Array.from(ndkEvents);
  if(!arr.length) return new Set();
  const newarr: (NDKRelayDiscovery | undefined)[] = arr.map( (event: NDKEvent) => {
      if(event.kind === NDKKind.RelayMonitor) {
        return new NDKRelayDiscovery(event.ndk, event.rawEvent());
      }
    });
  return new Set(newarr)
}

export const castSetRelayDiscovery = (ndkEvents: Set<NDKEvent>): Set<NDKRelayMeta | undefined>  => {
  const arr = Array.from(ndkEvents);
  if(!arr.length) return new Set();
  const newarr: (NDKRelayMeta | undefined)[] = arr.map( (event: NDKEvent) => {
      if(event.kind === NDKKind.RelayMonitor) {
        return new NDKRelayMeta(event.ndk, event.rawEvent());
      }
    });
  return new Set(newarr)
}