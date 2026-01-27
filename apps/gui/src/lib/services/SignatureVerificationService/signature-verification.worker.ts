/// <reference lib="webworker" />

import { verifyEvent } from 'nostr-tools/pure';

type VerifyRequest = {
  type: 'verify';
  requestId: string;
  events: any[];
};

type VerifyResponse = {
  type: 'verify-result';
  requestId: string;
  results: { id: string; valid: boolean }[];
};

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as VerifyRequest;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type !== 'verify') return;

  const results: { id: string; valid: boolean }[] = [];

  for (const raw of msg.events ?? []) {
    const id = raw?.id;
    if (typeof id !== 'string') continue;

    try {
      const sig = raw?.sig ?? raw?.signature;
      const normalized = sig ? { ...raw, sig } : raw;
      results.push({ id, valid: Boolean(verifyEvent(normalized)) });
    } catch {
      results.push({ id, valid: false });
    }
  }

  const res: VerifyResponse = { type: 'verify-result', requestId: msg.requestId, results };
  ctx.postMessage(res);
};

