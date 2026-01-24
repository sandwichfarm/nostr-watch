import type { IEvent } from '@nostrwatch/route66/models';
import { StateManager } from '@nostrwatch/route66';

import { assets } from '$app/paths';
import { instance, loadMonitorsFromCache } from '$lib/utils/lifecycle';
import { isSeeded, setStatsAsOf } from '$lib/stores/app';
import { publishEventsToMemoryRelay } from '$lib/stores/events-helpers';
import { monitorsMap, monitorsMapFromCache } from '$lib/stores/monitors';
import { addToBlocklist } from '$lib/stores/blocklist';
import {
  startBootActivity,
  updateBootActivity,
  completeBootActivity,
} from '$lib/stores/boot-activity';
import { setSeedBootComplete, setSeedBootError, setSeedBootInProgress } from '$lib/stores/boot-state';

type SeedGroup = { files?: string[]; events?: number; count?: number };

type Nip11Entry = { relay: string; nip11: any };

type SeedManifestV1 = {
  version: 1;
  generatedAt?: string;
  groups?: {
    monitors?: SeedGroup;
    blocklist?: SeedGroup;
    checks?: SeedGroup;
    operators?: SeedGroup;
    nip11s?: SeedGroup;
  };
};

const SEED_MANIFEST_URL = '/seed/manifest.json';
const STATE_KEY_GENERATED_AT = 'seed:build:generatedAt';

function resolveSeedAssetUrl(pathOrUrl: string): string {
  if (/^[a-z]+:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const prefix = (assets ?? '').replace(/\/$/, '');

  if (pathOrUrl.startsWith('/')) return prefix ? `${prefix}${pathOrUrl}` : pathOrUrl;

  const clean = pathOrUrl.replace(/^\/+/, '');
  if (!prefix) return `/${clean}`;
  return `${prefix}/${clean}`;
}

function hashString(input: string): string {
  // djb2 xor hash (fast + stable for small strings)
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = (hash * 33) ^ input.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

function computeSeedKey(manifest: SeedManifestV1): string {
  const generatedAt =
    typeof manifest.generatedAt === 'string' && manifest.generatedAt.trim().length > 0
      ? manifest.generatedAt.trim()
      : null;
  if (generatedAt) return generatedAt;

  const groups = manifest.groups ?? {};
  const normalizedGroups: Record<string, { files: string[]; events?: number; count?: number }> = {};
  for (const key of Object.keys(groups).sort()) {
    const group = (groups as any)[key] as SeedGroup | undefined;
    normalizedGroups[key] = {
      files: Array.isArray(group?.files) ? [...group.files].sort() : [],
      ...(typeof group?.events === 'number' ? { events: group.events } : {}),
      ...(typeof group?.count === 'number' ? { count: group.count } : {}),
    };
  }
  const stable = JSON.stringify({ version: manifest.version, groups: normalizedGroups });
  return `v${manifest.version}-${hashString(stable)}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const n = Math.max(1, size | 0);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<T | null> {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.max(0, opts.timeoutMs as number) : 15_000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs > 0 ? globalThis.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
  }
}

async function yieldToBrowser(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function formatProgress(loaded: number, total?: number): string {
  if (typeof total === 'number' && Number.isFinite(total) && total > 0) return `${loaded}/${total}`;
  return `${loaded}`;
}

async function seedEventsToCache(
  events: IEvent[],
  batchSize = 500,
  onBatch?: (count: number) => void
): Promise<void> {
  if (!events?.length) return;
  const $route66 = await instance();
  await $route66.ready();
  const cache = $route66.adapters.cacheAdapter;
  await cache.ready();

  for (const batch of chunk(events, batchSize)) {
    try {
      await cache.addEvents(batch);
    } catch {}
    try {
      onBatch?.(batch.length);
    } catch {}
    await yieldToBrowser();
  }
}

export const seedBuildData = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  // Note: We intentionally do NOT check tabState here. Build seed data is static
  // and read-only, so any tab can safely load it for fast first paint.

  startBootActivity('seed:manifest', 'Fetch Seed Manifest');
  await new Promise(resolve => setTimeout(resolve, 1))
  updateBootActivity('seed:manifest', 'fetching');

  try {
    const manifestUrl = resolveSeedAssetUrl(SEED_MANIFEST_URL);
    updateBootActivity('seed:manifest', `fetching (${manifestUrl})`);
    const manifest = await fetchJson<SeedManifestV1>(manifestUrl, { timeoutMs: 5_000 });
    if (!manifest || manifest.version !== 1) {
      completeBootActivity('seed:manifest', `not found (${manifestUrl})`);
      completeBootActivity('seed:monitors', 'skipped');
      completeBootActivity('seed:blocklist', 'skipped');
      completeBootActivity('seed:checks', 'skipped');
      completeBootActivity('seed:operators', 'skipped');
      completeBootActivity('seed:nip11s', 'skipped');
      // If no build-seed exists, consider the seed boot sequence complete so the UI
      // can fall back to network/cache hydration without being "stuck booting".
      setSeedBootComplete();
      return;
    }
    
    updateBootActivity('seed:manifest', 'found');
    completeBootActivity('seed:manifest');

    const seedKey = computeSeedKey(manifest);

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

    if (cacheHasData && StateManager.get(STATE_KEY_GENERATED_AT) === seedKey) {
      // Already seeded, show quick completion and set isSeeded
      // isSeeded.set(true);
      // setSeedBootComplete(seedKey);
      // startBootActivity('seed:monitors', 'Monitors');
      // completeBootActivity('seed:monitors', 'cached');
      // startBootActivity('seed:blocklist', 'Blocklist'); 
      // completeBootActivity('seed:blocklist', 'cached');
      // startBootActivity('seed:checks', 'Relay checks');
      // completeBootActivity('seed:checks', 'cached');
      // startBootActivity('seed:operators', 'Operators');
      // completeBootActivity('seed:operators', 'cached');
      // startBootActivity('seed:nip11s', 'NIP-11 info');
      // completeBootActivity('seed:nip11s', 'cached');
      // return; 
    }

    // We are about to do real seed work (fresh/broken state).
    setSeedBootInProgress();

    const groups = manifest.groups ?? {};
    const monitorFiles = groups.monitors?.files ?? [];
    const blocklistFiles = groups.blocklist?.files ?? [];
    const checkFiles = groups.checks?.files ?? [];
    const operatorFiles = groups.operators?.files ?? [];
    const nip11Files = groups.nip11s?.files ?? [];

    // Insert monitors/meta first (small), then checks, then operator meta and NIP-11s.
    // Boot sequence completes only after ALL groups are loaded.
    let seededSomething = false;
    let totalMonitors = 0;
    let totalChecks = 0;
    let totalOperators = 0;
    let totalNip11s = 0;
    let seedChecksMaxCreatedAt = 0;

    // Load monitors
    if (monitorFiles.length > 0) {
      startBootActivity('seed:monitors', 'Monitors');
      updateBootActivity('seed:monitors', formatProgress(0, groups.monitors?.events));
      const monitorEventsByPubkey = new Map<
        string,
        { registration?: IEvent; profile?: IEvent; relays?: IEvent }
      >();

      for (const url of monitorFiles) {
        const events = await fetchJson<IEvent[]>(resolveSeedAssetUrl(url), { timeoutMs: 15_000 });
        if (!Array.isArray(events) || events.length === 0) continue;
        seededSomething = true;
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
        await seedEventsToCache(events, 250, (count) => {
          totalMonitors += count;
          updateBootActivity('seed:monitors', formatProgress(totalMonitors, groups.monitors?.events));
        });

        completeBootActivity('seed:monitors', events.length)
      }

      await new Promise(resolve => setTimeout(resolve,500))

      // Build MonitorCached array and store in StateManager
      const DEFAULT_ENABLED_MONITORS = 5;

      // Sort monitors by number of checks (more checks = higher priority)
      const sortedMonitorEntries = Array.from(monitorEventsByPubkey.entries())
        .filter(([_, data]) => data.registration)
        .sort((a, b) => {
          const aChecks = (a[1].registration as any)?.tags?.filter((t: any) => t[0] === 'c')?.length ?? 0;
          const bChecks = (b[1].registration as any)?.tags?.filter((t: any) => t[0] === 'c')?.length ?? 0;
          return bChecks - aChecks; // Descending by check count
        });

      // Only enable the top 3 monitors by default (like maybeEnableMonitors)
      // lastActive uses registration timestamp - network sync will update with actual check times
      const monitorsCache = sortedMonitorEntries.map(([pubkey, data], index) => ({
        pubkey,
        registration: data.registration,
        profile: data.profile,
        relays: data.relays,
        priority: 0,
        enabled: index < DEFAULT_ENABLED_MONITORS,
        lastActive: data.registration?.created_at ?? -1,
      }));

      if (monitorsCache.length > 0) {
        StateManager.set('cache:monitors', monitorsCache);
        // Update the monitorsMap store so UI reacts immediately
        monitorsMap.set(monitorsMapFromCache());
        // Also load into MonitorService so route66.services.monitors is populated
        loadMonitorsFromCache();
        console.log('[seed] cached monitors to StateManager:', monitorsCache.length);
      }

      completeBootActivity('seed:monitors', formatProgress(totalMonitors, groups.monitors?.events));
    } else {
      completeBootActivity('seed:monitors', 'none');
    }

    await new Promise(resolve => setTimeout(resolve,500))

    // Load blocklist (must be before checks so filtering works)
    if (blocklistFiles.length > 0) {
      startBootActivity('seed:blocklist', 'Blocklist');
      updateBootActivity('seed:blocklist', formatProgress(0, groups.blocklist?.count));
      let totalBlocked = 0;
      for (const url of blocklistFiles) {
        const blockedUrls = await fetchJson<string[]>(resolveSeedAssetUrl(url), { timeoutMs: 15_000 });
        if (!Array.isArray(blockedUrls) || blockedUrls.length === 0) continue;
        seededSomething = true;
        totalBlocked += blockedUrls.length;
        addToBlocklist(blockedUrls);
        updateBootActivity('seed:blocklist', totalBlocked);
      }
      console.log('[seed] loaded blocklist with', totalBlocked, 'blocked relay URLs');
      completeBootActivity('seed:blocklist', formatProgress(totalBlocked, groups.blocklist?.count));
    } else {
      // `seed:blocklist` is not always present in every deployment/manifest.
      completeBootActivity('seed:blocklist', 'none');
    }

    await new Promise(resolve => setTimeout(resolve,500))

    // Seed NIP-11s to cache (small + high-signal payload)
    if (nip11Files.length > 0) {
      startBootActivity('seed:nip11s', 'NIP-11 info');
      updateBootActivity('seed:nip11s', formatProgress(0, groups.nip11s?.count));
      for (const url of nip11Files) {
        const entries = await fetchJson<Nip11Entry[]>(resolveSeedAssetUrl(url), { timeoutMs: 15_000 });
        if (!Array.isArray(entries) || entries.length === 0) continue;
        seededSomething = true;
        const expected = groups.nip11s?.count;

        // Batch upsert NIP-11s to cache
        try {
          const batchSize = 100;
          for (const batch of chunk(entries, batchSize)) {
            await cache.batchUpsertNip11(batch);
            totalNip11s += batch.length;
            updateBootActivity('seed:nip11s', formatProgress(totalNip11s, expected));
            await yieldToBrowser();
          }
        } catch (e) {
          console.warn('[seed] NIP-11 batch upsert failed, trying individually:', e);
          // Fallback to individual upserts if batch fails
          for (const entry of entries) {
            try {
              await cache.upsertNip11(entry.relay, entry.nip11);
              totalNip11s += 1;
              updateBootActivity('seed:nip11s', formatProgress(totalNip11s, expected));
            } catch {}
          }
        }
      }
      completeBootActivity('seed:nip11s', formatProgress(totalNip11s, groups.nip11s?.count));
    } else {
      completeBootActivity('seed:nip11s', 'none');
    }

    await new Promise(resolve => setTimeout(resolve,500))

    // Load checks (relay status dataset)
    if (checkFiles.length > 0) {
      startBootActivity('seed:checks', 'Relay checks');
      updateBootActivity('seed:checks', formatProgress(0, groups.checks?.events));
      for (const url of checkFiles) {
        const events = await fetchJson<IEvent[]>(resolveSeedAssetUrl(url), { timeoutMs: 15_000 });
        if (!Array.isArray(events) || events.length === 0) continue;
        seededSomething = true;
        for (const event of events as any[]) {
          const createdAt = (event as any)?.created_at;
          const seconds = typeof createdAt === 'number' ? createdAt : Number(createdAt);
          if (Number.isFinite(seconds) && seconds > seedChecksMaxCreatedAt) seedChecksMaxCreatedAt = seconds;
        }
        for (const batch of chunk(events, 1000)) {
          void publishEventsToMemoryRelay(batch, 'seed:build');
        }
        await seedEventsToCache(events, 100, (count) => {
          totalChecks += count;
          updateBootActivity('seed:checks', formatProgress(totalChecks, groups.checks?.events));
        });
      }
      completeBootActivity('seed:checks', formatProgress(totalChecks, groups.checks?.events));
    } else {
      completeBootActivity('seed:checks', 'none');
    }

    // Seed the stable "as-of" timestamp so UI liveness + counts use the seed snapshot
    // until the first full network sync completes.
    if (seedChecksMaxCreatedAt > 0) {
      setStatsAsOf(seedChecksMaxCreatedAt, { persist: true });
    } else if (typeof manifest.generatedAt === 'string') {
      const ms = Date.parse(manifest.generatedAt);
      if (Number.isFinite(ms) && ms > 0) setStatsAsOf(Math.round(ms / 1000), { persist: true });
    }

    await new Promise(resolve => setTimeout(resolve,500))

    // Load operators (lowest priority for first paint)
    if (operatorFiles.length > 0) {
      startBootActivity('seed:operators', 'Operators');
      updateBootActivity('seed:operators', formatProgress(0, groups.operators?.events));
      const operatorProfiles = new Map<string, any>(); // pubkey -> profile content

      for (const url of operatorFiles) {
        const events = await fetchJson<IEvent[]>(resolveSeedAssetUrl(url), { timeoutMs: 15_000 });
        if (!Array.isArray(events) || events.length === 0) continue;
        seededSomething = true;

        // Extract profile data for cache
        for (const event of events) {
          if (event.kind === 0 && event.pubkey) {
            try {
              const content = typeof event.content === 'string' ? JSON.parse(event.content) : event.content;
              operatorProfiles.set(event.pubkey, content);
            } catch {}
          }
        }

        for (const batch of chunk(events, 2000)) {
          void publishEventsToMemoryRelay(batch, 'seed:build');
        }
        await seedEventsToCache(events, 500, (count) => {
          totalOperators += count;
          updateBootActivity('seed:operators', formatProgress(totalOperators, groups.operators?.events));
        });
      }

      await new Promise(resolve => setTimeout(resolve,500))

      // Build operator rows cache so UI shows profiles immediately
      if (operatorProfiles.size > 0) {
        const operatorRows = Array.from(operatorProfiles.entries()).map(([pubkey, profile]) => ({
          id: pubkey,
          pubkey,
          name: profile?.name || profile?.display_name || null,
          displayName: profile?.display_name || null,
          about: profile?.about || null,
          picture: profile?.picture || null,
          banner: profile?.banner || null,
          nip05: profile?.nip05 || null,
          lud16: profile?.lud16 || null,
          website: profile?.website || null,
          // Placeholder counts - will be updated by live data
          relays: [],
          relaysCount: 0,
          isps: [],
          ispsCount: 0,
          softwares: [],
          softwaresCount: 0,
        }));
        StateManager.set('aggregate:operators', operatorRows);
        console.log('[seed] cached operator profiles:', operatorRows.length);
      }

      completeBootActivity('seed:operators', formatProgress(totalOperators, groups.operators?.events));
    } else {
      completeBootActivity('seed:operators', 'none');
    }

    await new Promise(resolve => setTimeout(resolve,500))

    if (seededSomething) {
      StateManager.set(STATE_KEY_GENERATED_AT, seedKey);
      isSeeded.set(true);
      setSeedBootComplete(seedKey);
    } else {
      // Nothing was seeded, but we did finish attempting; mark as complete so followers
      // don't wait forever on a missing/empty seed payload.
      setSeedBootComplete(seedKey);
    }
  } catch (e) {
    setSeedBootError(e);
    completeBootActivity('seed:manifest', 'error');
    completeBootActivity('seed:monitors', 'error');
    completeBootActivity('seed:blocklist', 'error');
    completeBootActivity('seed:checks', 'error');
    completeBootActivity('seed:operators', 'error');
    completeBootActivity('seed:nip11s', 'error');
    console.error('[seed] failed to load build seed', e);
  }
};
