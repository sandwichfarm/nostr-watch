#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function env(name, fallback = undefined) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw);
}

function envNumber(name, fallback) {
  const raw = env(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseArgs(argv) {
  const args = {
    dir: env('BUNNY_DEPLOY_DIR', path.resolve('apps/gui/dist')),
    target: env('BUNNY_TARGET_DIRECTORY', ''),
    concurrency: envNumber('BUNNY_CONCURRENCY', 50),
    purge: false,
    replicationTimeoutMs: envNumber('BUNNY_REPLICATION_TIMEOUT_MS', 15_000),
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = argv[++i];
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (a === '--replication-timeout-ms') args.replicationTimeoutMs = Number(argv[++i]);
    else if (a === '--purge') args.purge = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }

  return args;
}

function usage() {
  return `
Usage:
  node ./apps/gui/scripts/deploy-bunny.mjs [--dir <dist>] [--target <remote-subdir>] [--concurrency N] [--purge]

Required env:
  BUNNY_STORAGE_ENDPOINT            e.g. https://sg.storage.bunnycdn.com
  BUNNY_STORAGE_ZONE_NAME           e.g. nostr-watch
  BUNNY_STORAGE_ZONE_PASSWORD       (storage zone password)

Optional env (needed for --purge):
  BUNNY_API_KEY                     (account API key)
  BUNNY_PULL_ZONE_ID                e.g. 3313140
  BUNNY_REPLICATION_TIMEOUT_MS      default: 15000

Examples:
  BUNNY_STORAGE_ENDPOINT=https://sg.storage.bunnycdn.com \\
  BUNNY_STORAGE_ZONE_NAME=nostr-watch \\
  BUNNY_STORAGE_ZONE_PASSWORD=... \\
  node ./apps/gui/scripts/deploy-bunny.mjs --purge
`.trim();
}

function posixJoin(...parts) {
  return parts
    .filter((p) => typeof p === 'string' && p.length > 0)
    .join('/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

async function walkFiles(rootDir) {
  const out = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  await walk(rootDir);
  return out;
}

async function uploadFile({ endpoint, zoneName, zonePassword, targetDir, rootDir, filePath, dryRun }) {
  const rel = path.relative(rootDir, filePath).split(path.sep).join('/');
  const uploadPath = posixJoin(zoneName, targetDir, rel);
  const url = `${endpoint.replace(/\/+$/, '')}/${uploadPath}`;

  if (dryRun) {
    console.log('[bunny] dry-run PUT', url);
    return;
  }

  const body = fs.createReadStream(filePath);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey: zonePassword,
      'Content-Type': 'application/octet-stream',
    },
    body,
    // Required by Node's fetch when streaming request bodies.
    duplex: 'half',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}) ${url}${text ? `: ${text}` : ''}`);
  }
}

async function purgePullZone({ apiKey, pullZoneId, replicationTimeoutMs, dryRun }) {
  if (dryRun) {
    console.log('[bunny] dry-run purge', pullZoneId);
    return;
  }

  if (Number.isFinite(replicationTimeoutMs) && replicationTimeoutMs > 0) {
    await new Promise((r) => setTimeout(r, replicationTimeoutMs));
  }

  const url = `https://api.bunny.net/pullzone/${encodeURIComponent(pullZoneId)}/purgeCache`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { AccessKey: apiKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Purge failed (${res.status}) ${url}${text ? `: ${text}` : ''}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exitCode = 0;
    return;
  }

  const endpoint = env('BUNNY_STORAGE_ENDPOINT');
  const zoneName = env('BUNNY_STORAGE_ZONE_NAME');
  const zonePassword = env('BUNNY_STORAGE_ZONE_PASSWORD');

  if (!endpoint || !zoneName || !zonePassword) {
    console.error(usage());
    throw new Error('Missing required Bunny storage env vars.');
  }

  const rootDir = path.resolve(args.dir);
  const st = await fsp.stat(rootDir).catch(() => null);
  if (!st?.isDirectory()) {
    throw new Error(`Directory not found: ${rootDir}`);
  }

  const targetDir = (args.target || '').replace(/^\/+/, '').replace(/\/+$/, '');
  const concurrency = Number.isFinite(args.concurrency) ? Math.max(1, Math.floor(args.concurrency)) : 10;

  const files = await walkFiles(rootDir);
  console.log('[bunny] files', files.length);

  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, files.length || 1) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= files.length) break;
      const filePath = files[i];
      await uploadFile({
        endpoint,
        zoneName,
        zonePassword,
        targetDir,
        rootDir,
        filePath,
        dryRun: args.dryRun,
      });
      if ((i + 1) % 250 === 0 || i + 1 === files.length) {
        console.log(`[bunny] uploaded ${i + 1}/${files.length}`);
      }
    }
  });

  await Promise.all(workers);
  console.log('[bunny] upload complete');

  if (args.purge) {
    const apiKey = env('BUNNY_API_KEY');
    const pullZoneId = env('BUNNY_PULL_ZONE_ID');
    if (!apiKey || !pullZoneId) {
      throw new Error('Missing BUNNY_API_KEY or BUNNY_PULL_ZONE_ID for --purge');
    }
    console.log('[bunny] purging pull zone', pullZoneId);
    await purgePullZone({
      apiKey,
      pullZoneId,
      replicationTimeoutMs: args.replicationTimeoutMs,
      dryRun: args.dryRun,
    });
    console.log('[bunny] purge complete');
  }
}

main().catch((err) => {
  console.error('[bunny] deploy failed', err);
  process.exitCode = 1;
});

