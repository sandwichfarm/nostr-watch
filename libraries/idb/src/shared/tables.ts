

import type { NostrEvent } from "@nostr-dev-kit/ndk";


export interface IEvent {
  nid: string;
  monitorPubkey: string;
  relay?: string | null;
  event: NostrEvent;
  createdAt: number | null;
}

export type TransformOptionsType = { 
  parsedJson: Record<string, any>, 
  pubkey: string, 
  createdAt: number,
  nostrEvent?: NostrEvent
}

export interface IGeoCode {
  id?: number;
  created_at: number;
  code?: string | number;
  type?: string;
  format?: string;
  length?: number;
}

// export interface IGeohash {
//   monitorPubkey: string;
//   relay?: string;
//   geohash?: string;
//   created_at?: number;
// }

