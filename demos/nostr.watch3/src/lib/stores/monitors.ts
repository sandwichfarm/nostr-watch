import type { Readable } from "svelte/motion";
import { derived, writable, type Writable } from "svelte/store";
import type { ICheck } from "@nostrwatch/nip66/models";
import { checks } from "./checks";

interface Monitor {
  id: string;
}

export const monitors: Writable<Monitor[]> = writable([]);

export const monitorChecksCount: Readable<Record<string, number>> = derived(checks, ($checks) => {
  const countMap: Record<string, number> = {};
  $checks.forEach((check: ICheck) => {
    const pubkey = check.monitorPubkey;
    countMap[pubkey] = (countMap?.[pubkey] || 0) + 1;
  });
  return countMap;
});