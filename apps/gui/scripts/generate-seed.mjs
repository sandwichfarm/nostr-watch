import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SimplePool } from 'nostr-tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, 'static', 'seed');

const NIP66_RELAYS_DEFAULT = [
  'wss://relay.nostr.watch',
  'wss://relaypag.es',
  'wss://monitorlizard.nostr1.com/',
];

const USER_META_RELAYS_DEFAULT = [
  'wss://purplepag.es',
  'wss://user.kindpag.es',
  'wss://relay.nostr.band',
];

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function envString(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw);
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function chunk(arr, size) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const n = Math.max(1, size | 0);
  const chunks = [];
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
  return chunks;
}

function isHex64(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/i.test(s);
}

function normalizeRelayUrl(input) {
  if (typeof input !== 'string' || input.length < 3) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractFrequencySeconds(registrationEvent) {
  try {
    const tags = Array.isArray(registrationEvent?.tags) ? registrationEvent.tags : [];
    const raw = tags.find((t) => Array.isArray(t) && t[0] === 'frequency')?.[1];
    const parsed = Number(raw);
    const base = Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 12;
    return Math.round(base * 1.5);
  } catch {
    return Math.round(60 * 60 * 12 * 1.5);
  }
}

function extractOperatorPubkey(checkEvent) {
  try {
    const content = checkEvent?.content;
    if (typeof content === 'string' && content.length > 2 && content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        const pk = parsed?.pubkey;
        if (isHex64(pk)) return pk.toLowerCase();
      } catch {}
    }
  } catch {}

  try {
    const tags = Array.isArray(checkEvent?.tags) ? checkEvent.tags : [];
    const p = tags.find((t) => Array.isArray(t) && t[0] === 'p')?.[1];
    if (isHex64(p)) return p.toLowerCase();
  } catch {}

  return null;
}

function dTagValue(ev) {
  const tags = Array.isArray(ev?.tags) ? ev.tags : [];
  const d = tags.find((t) => Array.isArray(t) && t[0] === 'd')?.[1];
  return typeof d === 'string' ? d : null;
}

function upsertNewest(map, key, ev) {
  if (!key) return;
  const created = typeof ev?.created_at === 'number' ? ev.created_at : 0;
  const prev = map.get(key);
  const prevCreated = typeof prev?.created_at === 'number' ? prev.created_at : 0;
  if (!prev || created > prevCreated) map.set(key, ev);
}

async function ensureWebSocketImpl() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket;
  try {
    const mod = await import('ws');
    return mod.WebSocket ?? mod.default ?? mod;
  } catch (e) {
    throw new Error(
      `No WebSocket implementation available (Node must provide global WebSocket or install 'ws'): ${String(e)}`
    );
  }
}

async function queryMany(pool, relays, filters, { maxWaitMs }) {
  if (!filters.length || !relays.length) return { events: [], closes: [] };
  return await new Promise((resolve) => {
    const events = [];
    const closes = [];
    pool.subscribeManyEose(relays, filters, {
      maxWait: maxWaitMs,
      onevent: (event) => {
        events.push(event);
      },
      onclose: (reasons) => {
        if (Array.isArray(reasons)) closes.push(...reasons);
        resolve({ events, closes });
      },
    });
  });
}

async function main() {
  const websocketImplementation = await ensureWebSocketImpl();
  const pool = new SimplePool({ websocketImplementation });

  let nip66Relays = uniq(
    (envString('SEED_NIP66_RELAYS', '').split(',').map((s) => s.trim()).filter(Boolean).length
      ? envString('SEED_NIP66_RELAYS', '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : NIP66_RELAYS_DEFAULT
    )
      .map(normalizeRelayUrl)
      .filter(Boolean)
  );

  const userMetaRelays = uniq(
    (envString('SEED_USER_META_RELAYS', '').split(',').map((s) => s.trim()).filter(Boolean).length
      ? envString('SEED_USER_META_RELAYS', '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : USER_META_RELAYS_DEFAULT
    )
      .map(normalizeRelayUrl)
      .filter(Boolean)
  );

  const maxWaitMs = envNumber('SEED_MAX_WAIT_MS', 30_000);
  const maxActiveMonitors = envNumber('SEED_MAX_ACTIVE_MONITORS', 500);
  const checksPerMonitorLimit = envNumber('SEED_CHECKS_PER_MONITOR_LIMIT', 500);
  const maxCheckEvents = envNumber('SEED_MAX_CHECK_EVENTS', 100_000);
  const operatorPubkeyLimit = envNumber('SEED_MAX_OPERATOR_PUBKEYS', 5_000);
  const filtersPerReq = envNumber('SEED_MAX_FILTERS_PER_REQ', 10);
  const checksChunkSize = envNumber('SEED_CHECKS_CHUNK_SIZE', 5_000);
  const operatorsChunkSize = envNumber('SEED_OPERATORS_CHUNK_SIZE', 2_500);
  const nip11sChunkSize = envNumber('SEED_NIP11S_CHUNK_SIZE', 500);
  const maxNip11Relays = envNumber('SEED_MAX_NIP11_RELAYS', 5_000);
  const nip11TimeoutMs = envNumber('SEED_NIP11_TIMEOUT_MS', 5_000);
  const nip11Concurrency = envNumber('SEED_NIP11_CONCURRENCY', 30);

  console.log('[seed] relays', { nip66: nip66Relays.length, userMeta: userMetaRelays.length });

  // ---------------------------------------------------------------------------
  // 1) Monitor registrations (kind 10166)
  // ---------------------------------------------------------------------------
  const { events: registrationRaw, closes: registrationCloses } = await queryMany(
    pool,
    nip66Relays,
    [{ kinds: [10166], limit: 5000 }],
    { maxWaitMs }
  );
  if (registrationCloses.length) console.warn('[seed] registrations closes:', registrationCloses);

  const registrationsByPubkey = new Map();
  for (const ev of registrationRaw) {
    if (ev?.kind !== 10166) continue;
    if (typeof ev?.pubkey !== 'string') continue;
    upsertNewest(registrationsByPubkey, ev.pubkey, ev);
  }
  const registrations = Array.from(registrationsByPubkey.values());
  console.log('[seed] registrations', registrations.length);

  const monitorPubkeys = registrations.map((ev) => ev.pubkey).filter((v) => typeof v === 'string');

  // ---------------------------------------------------------------------------
  // 2) Monitor meta (kinds 0 + 10002)
  // ---------------------------------------------------------------------------
  const monitorMetaByKey = new Map();
  const metaLimitMultiplier = envNumber('SEED_META_LIMIT_MULTIPLIER', 4);
  const metaLimitMax = envNumber('SEED_META_LIMIT_MAX', 5000);
  const authorChunks = chunk(monitorPubkeys, envNumber('SEED_META_AUTHORS_PER_REQ', 50));

  for (const authors of authorChunks) {
    const limit = Math.min(metaLimitMax, Math.max(50, authors.length * metaLimitMultiplier));
    const { events, closes } = await queryMany(
      pool,
      userMetaRelays,
      [{ kinds: [0, 10002], authors, limit }],
      { maxWaitMs }
    );
    if (closes.length) console.warn('[seed] monitor-meta closes:', closes);
    for (const ev of events) {
      if (ev?.kind !== 0 && ev?.kind !== 10002) continue;
      if (typeof ev?.pubkey !== 'string') continue;
      upsertNewest(monitorMetaByKey, `${ev.pubkey}:${ev.kind}`, ev);
    }
  }

  const monitorMeta = Array.from(monitorMetaByKey.values());
  console.log('[seed] monitor meta', monitorMeta.length);

  // Bootstrap logic adds monitors' own relay lists to the nip66 relay pool.
  // This improves coverage for check events that may not land on the defaults.
  const maxExtraRelays = envNumber('SEED_MAX_EXTRA_NIP66_RELAYS', 50);
  if (maxExtraRelays > 0) {
    const extra = [];
    const seen = new Set(nip66Relays);
    for (const ev of monitorMeta) {
      if (ev?.kind !== 10002) continue;
      const tags = Array.isArray(ev?.tags) ? ev.tags : [];
      for (const tag of tags) {
        if (!Array.isArray(tag) || tag[0] !== 'r') continue;
        const url = normalizeRelayUrl(tag[1]);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        extra.push(url);
        if (extra.length >= maxExtraRelays) break;
      }
      if (extra.length >= maxExtraRelays) break;
    }
    if (extra.length) {
      nip66Relays = [...nip66Relays, ...extra];
      console.log('[seed] nip66 relays +extra', extra.length, '=>', nip66Relays.length);
    }
  }

  // ---------------------------------------------------------------------------
  // 3) Find active monitors (one recent check per monitor)
  // ---------------------------------------------------------------------------
  const activeLastSeen = new Map(); // pubkey -> created_at
  const activityFilters = [];
  const now = Math.round(Date.now() / 1000);
  for (const reg of registrations) {
    const pubkey = reg?.pubkey;
    if (typeof pubkey !== 'string') continue;
    const freq = extractFrequencySeconds(reg);
    activityFilters.push({
      kinds: [30166],
      authors: [pubkey],
      since: now - freq,
      until: now,
      limit: 1,
    });
  }

  for (const filters of chunk(activityFilters, filtersPerReq)) {
    const { events, closes } = await queryMany(pool, nip66Relays, filters, { maxWaitMs });
    if (closes.length) console.warn('[seed] activity closes:', closes);
    for (const ev of events) {
      if (ev?.kind !== 30166) continue;
      if (typeof ev?.pubkey !== 'string') continue;
      const created = typeof ev?.created_at === 'number' ? ev.created_at : 0;
      const prev = activeLastSeen.get(ev.pubkey) || 0;
      if (created > prev) activeLastSeen.set(ev.pubkey, created);
    }
  }

  // Sort by most recently active, but include ALL registered monitors up to cap
  // This ensures we get data from all monitors, not just the most active
  const allMonitorPubkeys = registrations.map((ev) => ev.pubkey).filter((v) => typeof v === 'string');

  const activeMonitorsSorted = Array.from(activeLastSeen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxActiveMonitors)
    .map(([pubkey]) => pubkey);

  // Include monitors that weren't detected as "active" but have registrations
  const inactiveMonitors = allMonitorPubkeys.filter((pk) => !activeLastSeen.has(pk));
  const monitorsToFetch = [...activeMonitorsSorted, ...inactiveMonitors.slice(0, Math.max(0, maxActiveMonitors - activeMonitorsSorted.length))];

  console.log('[seed] monitors to fetch checks from:', monitorsToFetch.length, '(active:', activeMonitorsSorted.length, ', inactive:', inactiveMonitors.length, ')');

  // ---------------------------------------------------------------------------
  // 4) Checks (kind 30166) for active monitors
  // ---------------------------------------------------------------------------
  const checksByKey = new Map(); // `${pubkey}:${d}` -> event

  // Use a 7-day window to get comprehensive seed data
  const checksSinceSeconds = envNumber('SEED_CHECKS_SINCE_DAYS', 7) * 24 * 60 * 60;

  const checkFilters = [];
  for (const pubkey of monitorsToFetch) {
    const filter = {
      kinds: [30166],
      authors: [pubkey],
      since: now - checksSinceSeconds,
      until: now,
    };
    if (Number.isFinite(checksPerMonitorLimit) && checksPerMonitorLimit > 0) {
      filter.limit = checksPerMonitorLimit;
    }
    checkFilters.push(filter);
  }

  for (const filters of chunk(checkFilters, filtersPerReq)) {
    if (checksByKey.size >= maxCheckEvents) break;
    const { events, closes } = await queryMany(pool, nip66Relays, filters, { maxWaitMs });
    if (closes.length) console.warn('[seed] checks closes:', closes);

    for (const ev of events) {
      if (ev?.kind !== 30166) continue;
      if (typeof ev?.pubkey !== 'string') continue;
      const d = dTagValue(ev);
      if (typeof d === 'string' && d.includes('echo.websocket.org')) continue;
      const key = d ? `${ev.pubkey}:${d}` : ev.id;
      upsertNewest(checksByKey, key, ev);
      if (checksByKey.size >= maxCheckEvents) break;
    }
  }

  const checks = Array.from(checksByKey.values()).sort(
    (a, b) => (b?.created_at ?? 0) - (a?.created_at ?? 0)
  );
  console.log('[seed] checks', checks.length);

  // ---------------------------------------------------------------------------
  // 5) Operator pubkeys -> meta (kinds 0 + 10002)
  // ---------------------------------------------------------------------------
  const operatorPubkeys = [];
  const operatorSeen = new Set();
  for (const ev of checks) {
    const pk = extractOperatorPubkey(ev);
    if (!pk) continue;
    if (operatorSeen.has(pk)) continue;
    operatorSeen.add(pk);
    operatorPubkeys.push(pk);
    if (operatorPubkeys.length >= operatorPubkeyLimit) break;
  }

  console.log('[seed] operator pubkeys (capped)', operatorPubkeys.length);

  const operatorMetaByKey = new Map();
  for (const authors of chunk(operatorPubkeys, envNumber('SEED_OPERATOR_META_AUTHORS_PER_REQ', 50))) {
    const limit = Math.min(metaLimitMax, Math.max(50, authors.length * metaLimitMultiplier));
    const { events, closes } = await queryMany(
      pool,
      userMetaRelays,
      [{ kinds: [0, 10002], authors, limit }],
      { maxWaitMs }
    );
    if (closes.length) console.warn('[seed] operator-meta closes:', closes);
    for (const ev of events) {
      if (ev?.kind !== 0 && ev?.kind !== 10002) continue;
      if (typeof ev?.pubkey !== 'string') continue;
      upsertNewest(operatorMetaByKey, `${ev.pubkey}:${ev.kind}`, ev);
    }
  }

  const operatorMeta = Array.from(operatorMetaByKey.values());
  console.log('[seed] operator meta', operatorMeta.length);

  // ---------------------------------------------------------------------------
  // 6) Fetch NIP-11 relay info documents
  // ---------------------------------------------------------------------------
  const relayUrls = new Set();
  for (const ev of checks) {
    const d = dTagValue(ev);
    const url = normalizeRelayUrl(d);
    if (url) relayUrls.add(url);
  }

  const relayUrlsArray = Array.from(relayUrls).slice(0, maxNip11Relays);
  console.log('[seed] relay URLs for NIP-11', relayUrlsArray.length);

  async function fetchNip11(wsUrl) {
    try {
      // Convert wss:// to https:// and ws:// to http://
      const httpUrl = wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), nip11TimeoutMs);

      const response = await fetch(httpUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/nostr+json' },
      });
      clearTimeout(timeout);

      if (!response.ok) return null;
      const json = await response.json();
      if (!json || typeof json !== 'object') return null;
      return { relay: wsUrl, nip11: json };
    } catch {
      return null;
    }
  }

  const nip11Results = [];
  const nip11Batches = chunk(relayUrlsArray, nip11Concurrency);
  let nip11Progress = 0;

  for (const batch of nip11Batches) {
    const results = await Promise.all(batch.map(fetchNip11));
    for (const result of results) {
      if (result) nip11Results.push(result);
    }
    nip11Progress += batch.length;
    if (nip11Progress % 100 === 0 || nip11Progress === relayUrlsArray.length) {
      console.log(`[seed] NIP-11 progress: ${nip11Progress}/${relayUrlsArray.length} (${nip11Results.length} successful)`);
    }
  }

  console.log('[seed] NIP-11s fetched', nip11Results.length);

  // ---------------------------------------------------------------------------
  // 7) Write output
  // ---------------------------------------------------------------------------
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const monitorsPayload = [...registrations, ...monitorMeta].sort((a, b) => {
    const ak = `${a.kind}:${a.pubkey}:${a.created_at ?? 0}`;
    const bk = `${b.kind}:${b.pubkey}:${b.created_at ?? 0}`;
    return ak.localeCompare(bk);
  });
  await fs.writeFile(path.join(outDir, 'monitors.json'), JSON.stringify(monitorsPayload));

  const checksFiles = [];
  const checkChunks = chunk(checks, checksChunkSize);
  for (let i = 0; i < checkChunks.length; i++) {
    const filename = `checks-${i}.json`;
    checksFiles.push(`/seed/${filename}`);
    await fs.writeFile(path.join(outDir, filename), JSON.stringify(checkChunks[i]));
  }

  const operatorFiles = [];
  const operatorChunks = chunk(operatorMeta, operatorsChunkSize);
  for (let i = 0; i < operatorChunks.length; i++) {
    const filename = `operators-${i}.json`;
    operatorFiles.push(`/seed/${filename}`);
    await fs.writeFile(path.join(outDir, filename), JSON.stringify(operatorChunks[i]));
  }

  const nip11Files = [];
  const nip11Chunks = chunk(nip11Results, nip11sChunkSize);
  for (let i = 0; i < nip11Chunks.length; i++) {
    const filename = `nip11s-${i}.json`;
    nip11Files.push(`/seed/${filename}`);
    await fs.writeFile(path.join(outDir, filename), JSON.stringify(nip11Chunks[i]));
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    relays: { nip66: nip66Relays, userMeta: userMetaRelays },
    caps: {
      maxWaitMs,
      maxActiveMonitors,
      checksPerMonitorLimit,
      maxCheckEvents,
      operatorPubkeyLimit,
      filtersPerReq,
      checksChunkSize,
      operatorsChunkSize,
      nip11sChunkSize,
      maxNip11Relays,
    },
    groups: {
      monitors: { files: ['/seed/monitors.json'], events: monitorsPayload.length },
      checks: { files: checksFiles, events: checks.length },
      operators: { files: operatorFiles, events: operatorMeta.length },
      nip11s: { files: nip11Files, count: nip11Results.length },
    },
  };

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  pool.destroy?.();
  console.log('[seed] wrote', {
    outDir,
    monitors: monitorsPayload.length,
    checks: checks.length,
    operators: operatorMeta.length,
    nip11s: nip11Results.length,
    files: { checks: checksFiles.length, operators: operatorFiles.length, nip11s: nip11Files.length },
  });
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exitCode = 1;
});
