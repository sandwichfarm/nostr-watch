import type { Readable } from "svelte/motion";
import { derived, writable, type Writable } from "svelte/store";

interface Check {
  relay: string;
  monitorPubkey: string;
  [id: string]: any;
}

export const checks: Writable<Check[]> = writable([]);
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