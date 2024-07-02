import { NostrEvent, NDKRelayMonitor } from '@nostr-dev-kit/ndk';
import { IMonitor } from './tables';

export type MonitorCacheData = {
  monitor: IMonitor,
}

const transform = ( relayMonitor: NDKRelayMonitor ): MonitorCacheData => {

  const { pubkey:monitorPubkey, checks, kinds, geohash, active:isActive, created_at:lastActive } = relayMonitor;
  const created_at: number = relayMonitor.created_at as number;

  console.log('transform:active?', isActive)

  const frequency = relayMonitor.frequency;

  let geocode: string[] = []

  if(relayMonitor.countryCode) geocode = relayMonitor.countryCode
  if(relayMonitor.regionCode) geocode = [ ...geocode, ...relayMonitor.regionCode ]
    
  const event = relayMonitor.rawEvent() as NostrEvent;
  
  const monitor = {
    monitorPubkey, 
    frequency,
    created_at,
    checks,
    kinds,
    geohash,
    geocode,
    isActive: isActive? 1: 0,
    event
  }

  console.log('transformed', monitorPubkey, monitor)

  return { 
    monitor
  }
}

export default transform 