import { writable, derived, get, type Writable, type Readable } from "svelte/store";
import type { IEvent } from "@nostrwatch/route66/models";
import { StateManager } from "@nostrwatch/route66";

// Dynamic import to avoid circular dependency
// lifecycle.ts → stores/index.js → checks.ts → monitors.ts → events-helpers.ts → blocklist.ts
async function getInstance() {
  const { instance } = await import("$lib/utils/lifecycle");
  return instance();
}

// Dynamic import for monitors to avoid circular dependency
async function getMonitors() {
  const { monitors } = await import("./monitors");
  return get(monitors);
}

const BLOCKLIST_CACHE_KEY = "cache:blocklist:relays";

/**
 * Normalize a relay URL for consistent comparison.
 * Removes trailing slashes and paths, lowercases hostname.
 */
export function normalizeRelayUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "wss:" && parsed.protocol !== "ws:") return null;
    // Remove path, just keep protocol + host
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}/`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Extract the base relay URL from a potentially junky URL.
 * e.g., wss://relay.damus.io/somejunk -> wss://relay.damus.io/
 */
export function extractBaseRelayUrl(url: string): string | null {
  return normalizeRelayUrl(url);
}

/**
 * Store for blocked relay URLs from monitor 10006 events.
 * Uses a Set for O(1) lookup.
 */
function loadBlocklistFromCache(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const cached = StateManager.get(BLOCKLIST_CACHE_KEY) as string[] | undefined;
    if (Array.isArray(cached)) return new Set(cached);
  } catch {}
  return new Set();
}

export const blockedRelays: Writable<Set<string>> = writable(loadBlocklistFromCache());

/**
 * Check if a relay URL is blocked.
 * Normalizes the URL before checking.
 */
export function isRelayBlocked(relayUrl: string): boolean {
  const normalized = normalizeRelayUrl(relayUrl);
  if (!normalized) return false;
  return get(blockedRelays).has(normalized);
}

/**
 * Check if an event's relay (from d-tag) is blocked.
 * Returns true if the event should be filtered out.
 */
export function isEventRelayBlocked(event: IEvent): boolean {
  if (event.kind !== 30166) return false;
  const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
  if (!dTag) return false;
  return isRelayBlocked(dTag);
}

/**
 * Filter an array of events, removing those with blocked relays.
 */
export function filterBlockedEvents(events: IEvent[]): IEvent[] {
  const blocked = get(blockedRelays);
  if (blocked.size === 0) return events;

  return events.filter(event => {
    if (event.kind !== 30166) return true; // Only filter check events
    const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
    if (!dTag) return true;
    const normalized = normalizeRelayUrl(dTag);
    if (!normalized) return true;
    return !blocked.has(normalized);
  });
}

/**
 * Add relays to the blocklist.
 */
export function addToBlocklist(relayUrls: string[]): void {
  blockedRelays.update(set => {
    for (const url of relayUrls) {
      const normalized = normalizeRelayUrl(url);
      if (normalized) set.add(normalized);
    }
    return set;
  });
  saveBlocklistToCache();
}

/**
 * Clear the blocklist.
 */
export function clearBlocklist(): void {
  blockedRelays.set(new Set());
  saveBlocklistToCache();
}

/**
 * Save blocklist to StateManager cache.
 */
function saveBlocklistToCache(): void {
  try {
    const list = Array.from(get(blockedRelays));
    StateManager.set(BLOCKLIST_CACHE_KEY, list);
  } catch {}
}

/**
 * Parse a kind 10006 event and extract blocked relay URLs.
 */
function parseBlocklistEvent(event: IEvent): string[] {
  if (event.kind !== 10006) return [];
  const relays: string[] = [];
  for (const tag of event.tags || []) {
    if (tag[0] === "r" || tag[0] === "relay") {
      const url = tag[1];
      if (url) {
        const normalized = normalizeRelayUrl(url);
        if (normalized) relays.push(normalized);
      }
    }
  }
  return relays;
}

/**
 * Sync blocklists from all active monitors.
 * Fetches kind 10006 events from monitors' relay lists.
 */
export async function syncBlocklists(): Promise<void> {
  const $route66 = await getInstance();
  await $route66.ready();

  const monitorList = await getMonitors();
  if (!monitorList?.length) {
    console.log("[blocklist] No monitors to sync blocklists from");
    return;
  }

  const monitorPubkeys = monitorList
    .filter(m => m.enabled && m.active)
    .map(m => m.pubkey)
    .filter(Boolean);

  if (monitorPubkeys.length === 0) {
    console.log("[blocklist] No active/enabled monitors to sync blocklists from");
    return;
  }

  console.log(`[blocklist] Syncing blocklists from ${monitorPubkeys.length} monitors`);

  // Fetch kind 10006 events from monitors
  const allBlockedRelays = new Set<string>();

  try {
    // First try to get from cache
    const cachedEvents = await $route66.adapters.cacheAdapter.REQ([
      { kinds: [10006], authors: monitorPubkeys }
    ]) as IEvent[];

    if (cachedEvents?.length) {
      for (const event of cachedEvents) {
        const relays = parseBlocklistEvent(event);
        relays.forEach(r => allBlockedRelays.add(r));
      }
      console.log(`[blocklist] Found ${cachedEvents.length} cached 10006 events with ${allBlockedRelays.size} unique blocked relays`);
    }
  } catch (e) {
    console.warn("[blocklist] Error fetching cached 10006 events:", e);
  }

  // Also fetch from network
  try {
    const networkEvents = await $route66.REQ([
      { kinds: [10006], authors: monitorPubkeys }
    ], { cache: true }) as IEvent[];

    if (networkEvents?.length) {
      for (const event of networkEvents) {
        const relays = parseBlocklistEvent(event);
        relays.forEach(r => allBlockedRelays.add(r));
      }
      console.log(`[blocklist] Fetched ${networkEvents.length} network 10006 events, total ${allBlockedRelays.size} unique blocked relays`);
    }
  } catch (e) {
    console.warn("[blocklist] Error fetching network 10006 events:", e);
  }

  // Update the blocklist store
  if (allBlockedRelays.size > 0) {
    blockedRelays.set(allBlockedRelays);
    saveBlocklistToCache();
    console.log(`[blocklist] Updated blocklist with ${allBlockedRelays.size} relays`);
  }
}

/**
 * Clean blocked relays from the cache.
 * Removes check events for blocked relay URLs.
 */
export async function cleanBlockedRelaysFromCache(): Promise<number> {
  const $route66 = await getInstance();
  await $route66.ready();
  const cache = $route66.adapters.cacheAdapter;

  const blocked = get(blockedRelays);
  if (blocked.size === 0) {
    console.log("[blocklist] No blocked relays to clean from cache");
    return 0;
  }

  console.log(`[blocklist] Cleaning ${blocked.size} blocked relays from cache...`);

  let deletedCount = 0;

  try {
    // Fetch all check events from cache
    const allChecks = await cache.REQ([{ kinds: [30166] }]) as IEvent[];

    const eventsToDelete: string[] = [];
    for (const event of allChecks) {
      const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
      if (!dTag) continue;
      const normalized = normalizeRelayUrl(dTag);
      if (normalized && blocked.has(normalized)) {
        eventsToDelete.push(event.id);
      }
    }

    if (eventsToDelete.length > 0) {
      // Delete events from cache (if the adapter supports it)
      if (typeof cache.deleteEvents === 'function') {
        await cache.deleteEvents(eventsToDelete);
        deletedCount = eventsToDelete.length;
      } else {
        console.warn("[blocklist] Cache adapter doesn't support deleteEvents");
      }
    }

    console.log(`[blocklist] Cleaned ${deletedCount} blocked relay events from cache`);
  } catch (e) {
    console.error("[blocklist] Error cleaning blocked relays from cache:", e);
  }

  return deletedCount;
}

// Derived store for blocklist count (for UI)
export const blockedRelayCount: Readable<number> = derived(
  blockedRelays,
  ($blockedRelays) => $blockedRelays.size
);
