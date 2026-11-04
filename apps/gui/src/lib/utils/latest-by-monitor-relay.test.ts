import { describe, it, expect } from 'vitest';
import { latestByMonitorRelay } from './latest-by-monitor-relay';

const MON_A = 'a'.repeat(64);
const MON_B = 'b'.repeat(64);
const HEX_D = 'c'.repeat(64);

const ev = (pubkey: string, d: string | undefined, created_at: number) =>
	({
		id: `${pubkey.slice(0, 4)}-${d}-${created_at}`,
		pubkey,
		kind: 30166,
		created_at,
		content: '',
		tags: d === undefined ? [] : [['d', d]]
	}) as any;

describe('latestByMonitorRelay', () => {
	it('counts wss://host and wss://host/ as one relay per monitor', () => {
		const map = latestByMonitorRelay([
			ev(MON_A, 'wss://a.example', 100),
			ev(MON_A, 'wss://a.example/', 200),
			ev(MON_B, 'wss://a.example/', 150)
		]);
		expect(map.size).toBe(2);
		expect(map.get(`${MON_A}:wss://a.example/`)?.created_at).toBe(200);
		expect(map.get(`${MON_B}:wss://a.example/`)?.created_at).toBe(150);
	});

	it('folds case and default-port variants into the same relay', () => {
		const map = latestByMonitorRelay([
			ev(MON_A, 'wss://A.Example', 100),
			ev(MON_A, 'wss://a.example:443', 300),
			ev(MON_A, 'wss://a.example/', 200)
		]);
		expect(map.size).toBe(1);
		expect([...map.values()][0].created_at).toBe(300);
	});

	it('keeps hex pubkey d tags as they are', () => {
		const map = latestByMonitorRelay([ev(MON_A, HEX_D, 100)]);
		expect(map.has(`${MON_A}:${HEX_D}`)).toBe(true);
	});

	it('skips events with a missing or non-ws d tag', () => {
		const map = latestByMonitorRelay([
			ev(MON_A, undefined, 100),
			ev(MON_A, 'not a url', 100),
			ev(MON_A, 'https://a.example', 100)
		]);
		expect(map.size).toBe(0);
	});
});
