/// <reference lib="deno.ns" />

import { parseRelayList } from "./parse.ts";
import { parseRelayNetwork } from "@nostrwatch/utils";
import { db, seedNewRelay } from "@nostrwatch/db";

interface Relay {
  url: string;
  network: string;
  online: boolean | null;
  ignore: boolean;
}

interface Event {
  id: string;
  kind: number;
  created_at: number;
}

export const calculateLastEvent = (ev: Event, since: number, lastEvent: number): number => {
  const timestamp = parseInt(ev.created_at.toString());
  return timestamp > lastEvent ? (timestamp > since ? timestamp : since) : lastEvent;
};

export const addRelaysToCache = async (relayList: Relay[]): Promise<string[]> => {
  const ids: string[] = [];
  for (const relayObj of relayList) {
    if (seedNewRelay(relayObj.url, relayObj.network)) {
      ids.push(relayObj.url);
    }
  }
  return ids;
};

export const relaysFromRelayList = async (ev: Event): Promise<Relay[] | false> => {
  const relayList = parseRelayList(ev);
  if (!relayList || relayList.length === 0) return false;

  return relayList.map(relay => ({
    url: relay,
    network: parseRelayNetwork(relay),
    online: null,
    ignore: false
  }));
}; 