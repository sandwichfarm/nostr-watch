import { get } from 'svelte/store';

import type { IEvent } from '@nostrwatch/route66/models';
import { StateManager } from '@nostrwatch/route66';

import { instance } from '$lib/utils/lifecycle';
import { hasBeenBootstrapped, isSeeded } from '$lib/stores/app';
import { publishEventsToMemoryRelay } from '$lib/stores/events-helpers';

type SeedGroup = { files?: string[]; events?: number };

type SeedManifestV1 = {
  version: 1;
  generatedAt?: string;
  groups?: {
    monitors?: SeedGroup;
    checks?: SeedGroup;
    operators?: SeedGroup;
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

  const manifest = await fetchJson<SeedManifestV1>(SEED_MANIFEST_URL);
  if (!manifest || manifest.version !== 1) return;

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

  if (cacheHasData && generatedAt && StateManager.get(STATE_KEY_GENERATED_AT) === generatedAt) return;

  const groups = manifest.groups ?? {};
  const monitorFiles = groups.monitors?.files ?? [];
  const checkFiles = groups.checks?.files ?? [];
  const operatorFiles = groups.operators?.files ?? [];

  // Insert monitors/meta first (small), then checks (needed for first paint),
  // then operator meta.
  let anyChecksSeeded = false;

  for (const url of monitorFiles) {
    const events = await fetchJson<IEvent[]>(url);
    if (!Array.isArray(events) || events.length === 0) continue;
    for (const batch of chunk(events, 500)) {
      void publishEventsToMemoryRelay(batch, 'seed:build');
    }
    await seedEventsToCache(events, 250);
  }

  for (const url of checkFiles) {
    const events = await fetchJson<IEvent[]>(url);
    if (!Array.isArray(events) || events.length === 0) continue;
    anyChecksSeeded = true;
    for (const batch of chunk(events, 2000)) {
      void publishEventsToMemoryRelay(batch, 'seed:build');
    }
    isSeeded.set(true);
    await seedEventsToCache(events, 500);
  }

  for (const url of operatorFiles) {
    const events = await fetchJson<IEvent[]>(url);
    if (!Array.isArray(events) || events.length === 0) continue;
    for (const batch of chunk(events, 2000)) {
      void publishEventsToMemoryRelay(batch, 'seed:build');
    }
    await seedEventsToCache(events, 500);
  }

  if (generatedAt) {
    StateManager.set(STATE_KEY_GENERATED_AT, generatedAt);
  }

  if (anyChecksSeeded) {
    isSeeded.set(true);
  }
};
