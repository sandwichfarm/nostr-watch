import type { DeltaBlotterItem, DeltaBlotterPoint } from '@nostrwatch/relay-charts';

type DeltaEventLike = {
  id?: string;
  created_at?: number;
  tags?: Array<string[]>;
};

const METADATA_TAGS = new Set(['r', 'status', 'O', 'T', 'rtt-open', 'retry']);

function parseDeltaTag(tag: string[]): DeltaBlotterItem | null {
  const rawKey = tag?.[0];
  if (!rawKey || METADATA_TAGS.has(rawKey)) return null;

  const rawValue = tag.length >= 2 ? tag[1] : null;
  const value = rawValue != null ? String(rawValue) : null;

  if (rawKey.startsWith('+')) {
    return { op: 'add', key: rawKey.slice(1), value };
  }
  if (rawKey.startsWith('-')) {
    return { op: 'remove', key: rawKey.slice(1), value };
  }
  return { op: 'change', key: rawKey, value };
}

function categoryForKey(key: string): string {
  if (key === 'dns' || key.startsWith('dns.')) return 'dns';
  if (key === 'geo' || key.startsWith('geo.')) return 'geo';
  if (key === 'limitation' || key.startsWith('limitation.')) return 'limitation';
  return 'info';
}

function directionForItems(items: DeltaBlotterItem[]): DeltaBlotterPoint['direction'] {
  const hasAdd = items.some((i) => i.op === 'add');
  const hasRemove = items.some((i) => i.op === 'remove');
  if (hasAdd && hasRemove) return 'mixed';
  if (hasAdd) return 'add';
  if (hasRemove) return 'remove';
  return 'change';
}

/**
 * Build "blotter" points from Kind 1066 delta events.
 *
 * Each point represents one event's deltas for a high-level category
 * (dns/geo/limitation/info). Tooltip content should surface the underlying
 * key/value pairs (including missing values).
 */
export function buildDeltaBlotterPoints(events: DeltaEventLike[]): DeltaBlotterPoint[] {
  const points: DeltaBlotterPoint[] = [];

  for (const ev of events ?? []) {
    const timestamp = ev?.created_at;
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue;

    const byCategory = new Map<string, DeltaBlotterItem[]>();

    for (const tag of ev?.tags ?? []) {
      const delta = parseDeltaTag(tag);
      if (!delta) continue;

      const category = categoryForKey(delta.key);
      const list = byCategory.get(category) ?? [];
      list.push(delta);
      byCategory.set(category, list);
    }

    for (const [category, items] of byCategory) {
      if (!items.length) continue;
      points.push({
        timestamp,
        category,
        direction: directionForItems(items),
        eventId: ev.id,
        items,
      });
    }
  }

  points.sort((a, b) => a.timestamp - b.timestamp);
  return points;
}

