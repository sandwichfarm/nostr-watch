import type { NostrEvent } from "@nostr-dev-kit/ndk";

export interface IEvent {
  nid: string;
  monitorPubkey: string;
  kind: number;
  relay?: string | null;
  event: NostrEvent;
  createdAt: number | null;
}

export interface IRelay {
  relay: string;
  lastSeen: number;
  network: string;
  score?: number | null;
}

export interface ICheck {
  nid: string;
  createdAt: number;
  relay: string;
  monitorPubkey: string;
  operatorPubkey?: string | null;
  network?: string | null;
  open?: number | null;
  read?: number | null;
  write?: number | null;
  geohash?: string | null;
  geocode?: (number | string)[] | null;
  validTo?: number | null;
  issuer?: string | null;
  ipv4?: string | null;
  ipv6?: string | null;
  isp?: string | null;
  supportedNips?: number[] | null;
  paymentRequired?: number | null;
  authRequired?: number | null;
  software?: string | null;
  version?: string | null;
}

export interface INip11 {
  createdAt: number;
  relay: string;
  hash: string | null;
  json: Record<string, any> | null;
  monitorPubkey?: string;
  nid?: string | null; //might not be set if populated outside of NIP-66
}

export interface IPastChecks {
  nid: string;
  relay: string;
  createdAt: number;
  monitorPubkey: string;
  operatorPubkey: string;
}

export interface IGlobalRtt {
  relay: string;
  createdAt: number;
  monitorPubkeys: string[];
  operatorPubkey: string;
  avgAll: number;
  avgOpen: number;
  avgRead: number;
  avgWrite: number;
}

export interface ISsl {
  nid: string;
  relay: string; 
  createdAt: number;
  monitorPubkey: string;
  hash: string;
  cert: string;
}