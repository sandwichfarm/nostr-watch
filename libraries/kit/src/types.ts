import { MonitorRelayFetcher as LocalRelayMonitor } from './monitor-relay-fetcher';
import { NDKRelayMonitor as NDKRelayMonitor } from '@nostr-dev-kit/ndk';

export type CombinedRelayMonitor = LocalRelayMonitor | NDKRelayMonitor;
export type CombinedRelayMonitorSet = Set<CombinedRelayMonitor>;