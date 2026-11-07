import type { IEvent } from '@nostrwatch/route66/models';

const HEX_PUBKEY = /^[0-9a-f]{64}$/;

/**
 * Normalise a 30166 `d` tag so URL variants (root slash, host case, default port)
 * count as one relay. NIP-66 also allows a hex pubkey as `d`; those are kept as is.
 * Preserve distinct paths and query strings, which can identify different relays.
 * Returns undefined when `d` is neither a hex pubkey nor a ws/wss URL.
 */
export function normalizeDTag(d: string | undefined): string | undefined {
	if (!d) return undefined;
	if (HEX_PUBKEY.test(d)) return d;
	// Only accept WebSocket schemes as published.
	if (!/^wss?:\/\//i.test(d)) return undefined;
	try {
		const url = new URL(d);
		url.hash = '';
		return url.href;
	} catch {
		return undefined;
	}
}

/**
 * Group 30166 events by (monitor pubkey, normalised relay d-tag) and keep only the latest.
 * Key format: "pubkey:relay"
 */
export function latestByMonitorRelay(events: IEvent[]): Map<string, IEvent> {
	const latest = new Map<string, IEvent>();
	for (const event of events) {
		const relay = normalizeDTag(event.tags?.find((t) => t[0] === 'd')?.[1]);
		if (!relay) continue;
		const key = `${event.pubkey}:${relay}`;
		const existing = latest.get(key);
		if (!existing || (event.created_at as number) > (existing.created_at as number)) {
			latest.set(key, event);
		}
	}
	return latest;
}
