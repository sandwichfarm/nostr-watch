import type { NostrEvent } from '@nostr-dev-kit/ndk';

export interface IMonitor {
  monitorPubkey: string;
  created_at: number;
  frequency: number;
  checks?: string[] | undefined;
  kinds?: number[] | undefined;
  geohash?: string | undefined;
  geocode?: (number | string)[] | undefined
  isActive?: number | undefined;
  lastActive?: number;
  event: NostrEvent;
}
