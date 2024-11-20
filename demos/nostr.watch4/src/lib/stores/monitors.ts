import type { Readable } from "svelte/motion";
import { derived, writable, type Writable } from "svelte/store";
import type { ICheck } from "@nostrwatch/nip66/models";
import { checks } from "./checks.js";
import { eventsArray } from "./events.js";
import type { IMonitor, IEvent } from "@nostrwatch/nip66/models";

export type Monitor = {
  priority?: number,
  registration?: IMonitor,
  relays?: string[],
  profile?: any
}

export const monitorsMap: Readable<Record<string, Monitor>> = derived(eventsArray, ($events) => {
  const map: Map<string, Monitor> = new Map();

  const registrations: IEvent[] = $events.filter((event) => event.kind === 10166);

  for (const registration of registrations) {
    const monitor: Monitor = {};

    monitor.profile = $events
      .filter((event) => event.kind === 0 && event.pubkey === registration.pubkey)
      .map((event) => {
        try {
          return JSON.parse(event.data);
        } catch (e) {
          return null;
        }
      })?.[0];

    const relayEvent = $events.find((event) => event.kind === 10002 && event.pubkey === registration.pubkey);
    monitor.relays = relayEvent?.tags
      .filter((tag) => tag[0] === 'r')
      .map((tag) => new URL(tag[1]).toString());

    monitor.registration = registration;

    map.set(registration.pubkey, monitor);
  }

  return Object.fromEntries(map.entries());
});


export const monitors: Readable<Monitor[]> = derived(monitorsMap, ($monitorsMap) => {
  return Object.values($monitorsMap);
});

export const monitorChecksCount: Readable<Record<string, number>> = derived(checks, ($checks) => {
  const countMap: Record<string, number> = {};
  $checks.forEach((check: ICheck) => {
    const pubkey = check.monitorPubkey;
    countMap[pubkey] = (countMap?.[pubkey] || 0) + 1;
  });
  return countMap;
});