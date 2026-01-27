import type { IEvent } from '@nostrwatch/route66/models';

export type LeaderTabSnapshotOptions = {
  kinds?: number[];
  limit?: number;
};

export type LeaderTabSnapshot = {
  events: IEvent[];
  buffered: number;
  maxEvents: number;
};

const MAX_EVENTS = 2000;
let buffer: IEvent[] = [];

export function recordLeaderTabEvents(events: IEvent[]) {
  if (!events?.length) return;

  for (const e of events as any[]) {
    const raw = (e as any)?.json ?? e;
    if (!raw || typeof raw !== 'object') continue;
    // Default to buffering only check events for now to keep payloads small.
    if (raw.kind !== 30166) continue;
    buffer.push(raw as IEvent);
  }

  if (buffer.length > MAX_EVENTS) {
    buffer = buffer.slice(buffer.length - MAX_EVENTS);
  }
}

export function getLeaderTabSnapshot(options: LeaderTabSnapshotOptions = {}): LeaderTabSnapshot {
  const kinds = Array.isArray(options.kinds) && options.kinds.length ? new Set(options.kinds) : null;
  const limit = typeof options.limit === 'number' && options.limit > 0 ? Math.floor(options.limit) : undefined;

  let events = buffer;
  if (kinds) events = events.filter((e: any) => kinds.has(e?.kind));
  if (limit) events = events.slice(-limit);

  return { events, buffered: buffer.length, maxEvents: MAX_EVENTS };
}

export function clearLeaderTabSnapshot() {
  buffer = [];
}

