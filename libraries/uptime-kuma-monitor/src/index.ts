import Nocap from '@nostrwatch/nocap';
import WebsocketAdapterDefault from '@nostrwatch/nocap-websocket-adapter-default';
import { KumaMonitorOptions, CheckKey, CheckResultSummary, KumaPushPayload, PingStrategy } from './types.js';

// Simple, dependency-free URL fetch wrapper supporting Node >=18 and Deno
async function httpGet(url: string): Promise<Response> {
  // Global fetch in Node >= 18 and Deno
  if (typeof fetch === 'function') return fetch(url);
  // Lazy import fallback if needed (should not usually happen in this monorepo)
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(url) as unknown as Response;
}

export function normalizeChecks(input?: CheckKey[]): CheckKey[] {
  if (!input || input.length === 0) return ['open', 'read'];
  // Remove duplicates and keep order
  const seen = new Set<CheckKey>();
  const out: CheckKey[] = [];
  for (const k of input) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export function aggregatePing(durations: Partial<Record<CheckKey, number>>, strategy: PingStrategy = 'sum'): number {
  const vals = Object.values(durations).filter((v): v is number => typeof v === 'number' && v >= 0);
  if (vals.length === 0) return -1;
  if (strategy === 'max') return Math.max(...vals);
  return vals.reduce((a, b) => a + b, 0);
}

export function summarizeResult(result: any, checks: CheckKey[], requiredChecks?: CheckKey[]): CheckResultSummary {
  const durations: Partial<Record<CheckKey, number>> = {};
  const failing: CheckKey[] = [];
  for (const k of checks) {
    const data = (result?.[k]?.data ?? result?.[k]);
    const dkey = `${k}_duration` as const;
    const dur = typeof result?.[dkey] === 'number' ? result[dkey] : result?.[k]?.duration;
    if (typeof dur === 'number') durations[k] = dur;
    if (data !== true) failing.push(k);
  }
  const req = new Set<CheckKey>((requiredChecks && requiredChecks.length ? requiredChecks : checks));
  const requiredFailed = failing.filter(f => req.has(f));
  const ok = requiredFailed.length === 0;
  return { ok, failing: requiredFailed, result, durations };
}

export async function runChecks(options: KumaMonitorOptions): Promise<CheckResultSummary> {
  const checks = normalizeChecks(options.checks);
  const required = normalizeChecks(options.requiredChecks ?? checks);

  const nocapCfg: any = options.nocap ?? {};
  if (!nocapCfg.checked_by) nocapCfg.checked_by = '@nostrwatch/kuma';

  const nc = new Nocap(options.relayUrl, nocapCfg);
  await nc.useAdapter(WebsocketAdapterDefault);

  // nocap always terminates websocket unless configured otherwise
  const headers = options.headers ?? true;
  const raw = await nc.check(checks, headers);

  return summarizeResult(raw, checks, required);
}

export function buildKumaPayload(summary: CheckResultSummary, strategy: PingStrategy = 'sum'): KumaPushPayload {
  const status: KumaPushPayload['status'] = summary.ok ? 'up' : 'down';
  const ping = aggregatePing(summary.durations, strategy);

  let msg: string;
  if (summary.ok) {
    // show durations for visibility
    const parts = Object.entries(summary.durations)
      .map(([k, v]) => `${k}=${v}ms`)
      .join(', ');
    msg = parts ? `OK (${parts})` : 'OK';
  } else {
    msg = `Fail: ${summary.failing.join(', ')}`;
  }

  const payload: KumaPushPayload = { status, msg };
  if (ping >= 0) payload.ping = ping;
  return payload;
}

export function appendQuery(url: string, params: Record<string, string | number | undefined>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export async function pushToKuma(pushUrl: string, payload: KumaPushPayload): Promise<void> {
  const finalUrl = appendQuery(pushUrl, {
    status: payload.status,
    msg: payload.msg ?? '',
    ping: payload.ping ?? undefined,
  });
  const res = await httpGet(finalUrl);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kuma push failed: ${res.status} ${res.statusText} ${text}`);
  }
}

export async function runOnce(options: KumaMonitorOptions): Promise<void> {
  const summary = await runChecks(options);
  const payload = buildKumaPayload(summary, options.pingStrategy ?? 'sum');
  await pushToKuma(options.pushUrl, payload);
}

export async function runForever(options: KumaMonitorOptions): Promise<() => void> {
  const interval = options.intervalMs ?? 60000; // default 60s
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      await runOnce(options);
    } catch (err) {
      // As a safety net, signal down push if check or push threw synchronously
      try {
        const msg = err instanceof Error ? err.message : String(err);
        await pushToKuma(options.pushUrl, { status: 'down', msg });
      } catch {}
    } finally {
      if (!stopped) setTimeout(tick, interval);
    }
  };

  // Prime immediately
  void tick();

  return () => {
    stopped = true;
  };
}

export default {
  runChecks,
  runOnce,
  runForever,
  buildKumaPayload,
  pushToKuma,
};
