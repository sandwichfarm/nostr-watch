import type { Readable } from "svelte/motion";
import { derived, writable, type Writable } from "svelte/store";

interface Check {
  relay: string;
  monitorPubkey: string;
  [id: string]: any;
}

import { events } from './events.js'; // Adjust the import path as necessary

export const checks = derived(events, ($events) => {
  return $events.map((event) => {
    const nid = event.id;

    // Extract relay URL
    const dTag = event.tags.find((tag) => tag[0] === 'd');
    const relay = dTag ? new URL(dTag[1]).toString() : null;

    const monitorPubkey = event.pubkey;
    const created_at = event.created_at;

    // Extract various metadata from tags
    const network = event.tags.find((tag) => tag[0] === 'n')?.[1] || null;
    const rttOpen = parseInt(event.tags.find((tag) => tag[0] === 'rtt-open')?.[1]) || null;
    const rttWrite = parseInt(event.tags.find((tag) => tag[0] === 'rtt-write')?.[1]) || null;
    const rtt = rttOpen || rttWrite || null;

    const operatorPubkey = event.tags.find((tag) => tag[0] === 'p')?.[1] || null;

    const supportedNips = event.tags
      .filter((tag) => tag[0] === 'N')
      .map((tag) => parseInt(tag[1])) || null;

    const software = event.tags.find((tag) => tag[0] === 's')?.[1] || null;
    const version = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'nip11.version')?.[1] || null;

    const paymentRequired = event.tags.some((tag) => tag[0] === 'R' && tag[1] === 'payment') ? 1 : 0;
    const authRequired = event.tags.some((tag) => tag[0] === 'R' && tag[1] === 'auth') ? 1 : 0;

    const geohash = event.tags.filter((tag) => tag[0] === 'g').map((tag) => tag[1]) || null;
    const geocode = event.tags.filter((tag) => tag[0] === 'l' && tag[2] === 'countryCode').map((tag) => tag[1]) || null;

    const isp = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'host.isp')?.[1] || null;
    const as = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'host.as')?.[1] || null;
    const asname = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'host.asn')?.[1] || null;

    const ipv4 = event.tags.filter((tag) => tag[0] === 'l' && tag[2] === 'dns.ipv4').map((tag) => tag[1]) || null;

    return {
      nid,
      relay,
      monitorPubkey,
      created_at,
      network,
      rtt,
      operatorPubkey,
      supportedNips,
      software,
      version,
      paymentRequired,
      authRequired,
      geohash,
      geocode,
      isp,
      as,
      asname,
      ipv4,
      ipv6: null,
      sslValidTo: null,
      sslIssuer: null,
    };
  });
});


export const pastChecks: Writable<Check[]> = writable([]);

export const relayChecks: Readable<Record<string, { a: Record<string, any>, checks: Check[], aggregate?: any }>> = derived(checks, ($checks) => {
  const countMap: Record<string, { a: Record<string, any>, checks: Check[], aggregate?: any }> = {};
  $checks.forEach(check => {
    const relay = check.relay;
    if (!countMap[relay]) {
      countMap[relay] = { a: {}, checks: [] };
    }
    countMap[relay].checks.push(check);
  });

  Object.keys(countMap).forEach(relay => {
    countMap[relay].aggregate = countMap[relay].checks.reduceRight((acc, obj) => {
      Object.keys(obj).forEach(key => {
        if (!(key in acc)) {
          // Initialize with the first value encountered
          acc[key] = obj[key];
        } else if (obj[key] !== null && obj[key] !== undefined) {
          // Update only if the current value is non-null and non-undefined
          acc[key] = obj[key];
        }
      });
      return acc;
    }, {});
  });
  return countMap;
});

export const relayAggregates: Readable<any[]> = derived(relayChecks, ($relayChecks) => {
  return Object.values($relayChecks).map((item, index) => ({ ...item.aggregate, id: index }));
});