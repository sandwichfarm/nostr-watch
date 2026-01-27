#!/usr/bin/env node
import { runOnce, runForever } from './index.js';
import type { CheckKey, KumaMonitorOptions } from './types.js';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function asChecks(value?: string | boolean): CheckKey[] | undefined {
  if (!value || typeof value !== 'string') return undefined;
  return value.split(',').map(s => s.trim()).filter(Boolean) as CheckKey[];
}

function asNumber(value?: string | boolean): number | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const a = parseArgs(argv);

  const relayUrl = (a.relay as string) || (process.env.RELAY_URL ?? '');
  const pushUrl = (a['push-url'] as string) || (process.env.KUMA_PUSH_URL ?? '');
  const checks = asChecks(a.checks) || (process.env.CHECKS ? asChecks(process.env.CHECKS) : undefined);
  const includeWrite = a.write === true || process.env.CHECK_WRITE === 'true';
  const once = a.once === true || process.env.KUMA_ONCE === 'true';
  const intervalMs = asNumber(a.interval) ?? (process.env.KUMA_INTERVAL_MS ? Number(process.env.KUMA_INTERVAL_MS) : undefined);
  const logLevel = (a['log-level'] as string) || process.env.NOCAP_LOG_LEVEL;

  if (!relayUrl || !pushUrl) {
    console.error('Usage: nostrwatch-kuma --relay <wss://relay> --push-url <https://kuma/api/push/<key>> [--checks open,read[,write]] [--once] [--interval 60000] [--log-level debug] [--write-sample-json <json>]');
    process.exit(2);
  }

  const opts: KumaMonitorOptions = {
    relayUrl,
    pushUrl,
    checks: checks ?? (includeWrite ? ['open', 'read', 'write'] : ['open', 'read']),
    requiredChecks: undefined, // default = checks
    nocap: {
      logLevel: logLevel || 'info',
    },
    headers: true,
    once,
    intervalMs: intervalMs ?? 60000,
  };

  const writeSample = (a['write-sample-json'] as string) || process.env.NOCAP_WRITE_SAMPLE_JSON;
  if (writeSample) {
    try {
      opts.nocap = opts.nocap || {};
      opts.nocap.event_sample = JSON.parse(writeSample);
    } catch (e) {
      console.warn('Ignoring invalid --write-sample-json (must be valid JSON)');
    }
  }

  if (opts.once) {
    await runOnce(opts);
  } else {
    await runForever(opts);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

