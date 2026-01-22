import { Nip66CheckEvent } from '@nostrwatch/route66/models';
import { relayCheckAggregator, type RelayChecksByRelay } from '../derivations/relay-checks-aggregate';

type PatchMessage = {
  type: 'patch';
  upserts?: { key: string; event: any }[];
  removals?: string[];
};

type SetActiveKeysMessage = {
  type: 'setActiveKeys';
  activeKeys: string[];
};

type SetNip11ErrorsMessage = {
  type: 'setNip11Errors';
  entries: [string, number][];
};

type IncomingMessage = PatchMessage | SetActiveKeysMessage | SetNip11ErrorsMessage;

type ResultMessage = {
  type: 'result';
  relayChecks: RelayChecksByRelay;
  stats: { checks: number; relays: number; computeMs: number };
};

const ctx: DedicatedWorkerGlobalScope = self as any;

let checksByKey = new Map<string, Nip66CheckEvent>();
let activeKeys: string[] = [];
let nip11Errors = new Map<string, number>();

let computeTimer: ReturnType<typeof setTimeout> | null = null;
const COMPUTE_DEBOUNCE_MS = 50;

function scheduleCompute() {
  if (computeTimer) clearTimeout(computeTimer);
  computeTimer = setTimeout(runCompute, COMPUTE_DEBOUNCE_MS);
}

function runCompute() {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const checks = Array.from(checksByKey.values()) as unknown as Record<string, any>[];
  const relayChecks = relayCheckAggregator(checks, activeKeys, nip11Errors);

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const msg: ResultMessage = {
    type: 'result',
    relayChecks,
    stats: {
      checks: checksByKey.size,
      relays: Object.keys(relayChecks).length,
      computeMs: Math.round((end - start) * 100) / 100,
    },
  };

  ctx.postMessage(msg);
}

ctx.onmessage = (ev: MessageEvent) => {
  const message = ev.data as IncomingMessage;
  if (!message || typeof message !== 'object') return;

  if (message.type === 'patch') {
    const { upserts, removals } = message;

    if (Array.isArray(upserts)) {
      for (const item of upserts) {
        if (!item?.key || !item?.event) continue;
        if (item.event.kind !== 30166) continue;
        checksByKey.set(item.key, new Nip66CheckEvent(item.event));
      }
    }

    if (Array.isArray(removals)) {
      for (const key of removals) {
        if (typeof key !== 'string') continue;
        checksByKey.delete(key);
      }
    }

    scheduleCompute();
    return;
  }

  if (message.type === 'setActiveKeys') {
    activeKeys = Array.isArray(message.activeKeys) ? message.activeKeys : [];
    scheduleCompute();
    return;
  }

  if (message.type === 'setNip11Errors') {
    nip11Errors = new Map(Array.isArray(message.entries) ? message.entries : []);
    scheduleCompute();
    return;
  }
};
