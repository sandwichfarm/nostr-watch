import { get } from 'svelte/store';

import type { IEvent } from '@nostrwatch/route66/models';
import { StateManager } from '@nostrwatch/route66';

import { instance } from '$lib/utils/lifecycle';
import { hasBeenBootstrapped, isSeeded } from '$lib/stores/app';
import { publishEventsToMemoryRelay } from '$lib/stores/events-helpers';
import {
  startBootActivity,
  updateBootActivity,
  completeBootActivity,
} from '$lib/stores/boot-activity';

type SeedGroup = { files?: string[]; events?: number; count?: number };

type Nip11Entry = { relay: string; nip11: any };

type SeedManifestV1 = {
  version: 1;
  generatedAt?: string;
  groups?: {
    monitors?: SeedGroup;
    checks?: SeedGroup;
    operators?: SeedGroup;
    nip11s?: SeedGroup;
  };
};

const SEED_MANIFEST_URL = '/seed/manifest.json';
const STATE_KEY_GENERATED_AT = 'seed:build:generatedAt';

function chunk<T>(arr: T[], size: number): T[][] {
  const n = Math.max(1, size | 0);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function yieldToBrowser(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function seedEventsToCache(events: IEvent[], batchSize = 500): Promise<void> {
  if (!events?.length) return;
  const $route66 = await instance();
  await $route66.ready();
  const cache = $route66.adapters.cacheAdapter;
  await cache.ready();

  for (const batch of chunk(events, batchSize)) {
    try {
      await cache.addEvents(batch);
    } catch {}
    await yieldToBrowser();
  }
}

export const seedBuildData = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  // Note: We intentionally do NOT check tabState here. Build seed data is static
  // and read-only, so any tab can safely load it for fast first paint.

  startBootActivity('seed:manifest', 'Loading seed manifest');

  const manifest = await fetchJson<SeedManifestV1>(SEED_MANIFEST_URL);
  if (!manifest || manifest.version !== 1) {
    completeBootActivity('seed:manifest', 'not found');
    return;
  }
  completeBootActivity('seed:manifest');

  const generatedAt = typeof manifest.generatedAt === 'string' ? manifest.generatedAt : null;

  // Check if cache actually has data before skipping seed.
  // This handles the case where localStorage says "bootstrapped" but cache was cleared.
  const $route66 = await instance();
  await $route66.ready();
  const cache = $route66.adapters.cacheAdapter;
  await cache.ready();

  let cacheHasData = false;
  try {
    const checkCount = await cache.COUNT([{ kinds: [30166] }]);
    // If cache has at least 100 check events, consider it seeded
    cacheHasData = checkCount >= 100;
  } catch {}

  if (cacheHasData && generatedAt && StateManager.get(STATE_KEY_GENERATED_AT) === generatedAt) {
    // Already seeded, show quick completion
    startBootActivity('seed:monitors', 'Loading monitors');
    completeBootActivity('seed:monitors', 'cached');
    startBootActivity('seed:checks', 'Loading relay checks');
    completeBootActivity('seed:checks', 'cached');
    startBootActivity('seed:operators', 'Loading operator profiles');
    completeBootActivity('seed:operators', 'cached');
    startBootActivity('seed:nip11s', 'Loading NIP-11 relay info');
    completeBootActivity('seed:nip11s', 'cached');
    return;
  }

  const groups = manifest.groups ?? {};
  const monitorFiles = groups.monitors?.files ?? [];
  const checkFiles = groups.checks?.files ?? [];
  const operatorFiles = groups.operators?.files ?? [];
  const nip11Files = groups.nip11s?.files ?? [];

  // Insert monitors/meta first (small), then checks (needed for first paint),
  // then operator meta.
  let anyChecksSeeded = false;
  let totalMonitors = 0;
  let totalChecks = 0;
  let totalOperators = 0;
  let totalNip11s = 0;

  // Load monitors
  if (monitorFiles.length > 0) {
    startBootActivity('seed:monitors', 'Loading monitors');
    const monitorEventsByPubkey = new Map<string, { registration?: IEvent; profile?: IEvent; relays?: IEvent }>();

    for (const url of monitorFiles) {
      const events = await fetchJson<IEvent[]>(url);
      if (!Array.isArray(events) || events.length === 0) continue;
      totalMonitors += events.length;
      updateBootActivity('seed:monitors', totalMonitors);

      // Group events by pubkey for cache:monitors
      for (const event of events) {
        if (!event?.pubkey) continue;
        let entry = monitorEventsByPubkey.get(event.pubkey);
        if (!entry) {
          entry = {};
          monitorEventsByPubkey.set(event.pubkey, entry);
        }
        if (event.kind === 10166) entry.registration = event;
        else if (event.kind === 0) entry.profile = event;
        else if (event.kind === 10002) entry.relays = event;
      }

      for (const batch of chunk(events, 500)) {
        void publishEventsToMemoryRelay(batch, 'seed:build');
      }
      await seedEventsToCache(events, 250);
    }

    // Build MonitorCached array and store in StateManager
    const monitorsCache = Array.from(monitorEventsByPubkey.entries())
      .filter(([_, data]) => data.registration) // Must have registration
      .map(([pubkey, data]) => ({
        pubkey,
        registration: data.registration,
        profile: data.profile,
        relays: data.relays,
        priority: 0,
        enabled: true,
        lastActive: data.registration?.created_at ?? -1,
      }));

    if (monitorsCache.length > 0) {
      StateManager.set('cache:monitors', monitorsCache);
      console.log('[seed] cached monitors to StateManager:', monitorsCache.length);
    }

    completeBootActivity('seed:monitors', totalMonitors);
  }

  // Load checks
  if (checkFiles.length > 0) {
    startBootActivity('seed:checks', 'Loading relay checks');
    for (const url of checkFiles) {
      const events = await fetchJson<IEvent[]>(url);
      if (!Array.isArray(events) || events.length === 0) continue;
      anyChecksSeeded = true;
      totalChecks += events.length;
      updateBootActivity('seed:checks', totalChecks);
      for (const batch of chunk(events, 2000)) {
        void publishEventsToMemoryRelay(batch, 'seed:build');
      }
      isSeeded.set(true);
      await seedEventsToCache(events, 500);
    }
    completeBootActivity('seed:checks', totalChecks);
  }

  // Load operators
  if (operatorFiles.length > 0) {
    startBootActivity('seed:operators', 'Loading operator profiles');
    for (const url of operatorFiles) {
      const events = await fetchJson<IEvent[]>(url);
      if (!Array.isArray(events) || events.length === 0) continue;
      totalOperators += events.length;
      updateBootActivity('seed:operators', totalOperators);
      for (const batch of chunk(events, 2000)) {
        void publishEventsToMemoryRelay(batch, 'seed:build');
      }
      await seedEventsToCache(events, 500);
    }
    completeBootActivity('seed:operators', totalOperators);
  }

  // Seed NIP-11s to cache
  if (nip11Files.length > 0) {
    startBootActivity('seed:nip11s', 'Loading NIP-11 relay info');
    for (const url of nip11Files) {
      const entries = await fetchJson<Nip11Entry[]>(url);
      if (!Array.isArray(entries) || entries.length === 0) continue;
      totalNip11s += entries.length;
      updateBootActivity('seed:nip11s', totalNip11s);

      // Batch upsert NIP-11s to cache
      try {
        const batchSize = 100;
        for (const batch of chunk(entries, batchSize)) {
          await cache.batchUpsertNip11(batch);
          await yieldToBrowser();
        }
      } catch (e) {
        console.warn('[seed] NIP-11 batch upsert failed, trying individually:', e);
        // Fallback to individual upserts if batch fails
        for (const entry of entries) {
          try {
            await cache.upsertNip11(entry.relay, entry.nip11);
          } catch {}
        }
      }
    }
    completeBootActivity('seed:nip11s', totalNip11s);
  }

  if (generatedAt) {
    StateManager.set(STATE_KEY_GENERATED_AT, generatedAt);
  }

  if (anyChecksSeeded) {
    isSeeded.set(true);
  }
};
