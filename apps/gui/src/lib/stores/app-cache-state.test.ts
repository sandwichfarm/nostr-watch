import { afterEach, describe, expect, it } from 'vitest';
import { StateManager } from '@nostrwatch/route66';

import { hasUsableCachedData, shouldForceFullBootstrap, shouldRequireSeedBootstrap } from './app';

const CACHE_KEYS = [
	'aggregate:complete',
	'count:events:checks',
	'cache:monitors',
	'aggregate:relays',
	'relays:minisearch',
	'aggregate:operators'
];

const clearCacheKeys = () => {
	for (const key of CACHE_KEYS) {
		try {
			StateManager.remove(key);
		} catch {}
	}
};

describe('cached boot state', () => {
	afterEach(() => {
		clearCacheKeys();
	});

	it('does not require the boot screen when static aggregate cache exists', () => {
		clearCacheKeys();
		StateManager.set('aggregate:complete', 'cached-aggregate-payload');

		expect(hasUsableCachedData()).toBe(true);
		expect(
			shouldRequireSeedBootstrap({
				bootstrapped: false,
				seeded: false,
				seedBootStatus: 'idle',
				hasUsableCache: hasUsableCachedData()
			})
		).toBe(false);
	});

	it('requires seed bootstrap only for a real first visit with no markers or cache', () => {
		clearCacheKeys();

		expect(hasUsableCachedData()).toBe(false);
		expect(
			shouldRequireSeedBootstrap({
				bootstrapped: false,
				seeded: false,
				seedBootStatus: 'idle',
				hasUsableCache: false
			})
		).toBe(true);
	});

	it('keeps temporary suspension idempotent for in-progress resync with cache', () => {
		clearCacheKeys();
		StateManager.set('count:events:checks', 100);

		const state = {
			bootstrapped: false,
			seeded: false,
			seedBootStatus: 'in_progress' as const,
			hasUsableCache: hasUsableCachedData()
		};

		expect(shouldRequireSeedBootstrap(state)).toBe(false);
		expect(shouldRequireSeedBootstrap(state)).toBe(false);
	});

	it('does not force full sync when bootstrap markers are missing but cache exists', () => {
		expect(
			shouldForceFullBootstrap({
				bootstrapped: false,
				hasUsableCache: true,
				opfsStatus: 'online'
			})
		).toBe(false);
	});

	it('still forces full sync for real first visit or cache fallback states', () => {
		expect(
			shouldForceFullBootstrap({
				bootstrapped: false,
				hasUsableCache: false,
				opfsStatus: 'online'
			})
		).toBe(true);
		expect(
			shouldForceFullBootstrap({
				bootstrapped: true,
				hasUsableCache: true,
				opfsStatus: 'fallback'
			})
		).toBe(true);
		expect(
			shouldForceFullBootstrap({
				bootstrapped: true,
				hasUsableCache: true,
				opfsStatus: 'error'
			})
		).toBe(true);
	});
});
