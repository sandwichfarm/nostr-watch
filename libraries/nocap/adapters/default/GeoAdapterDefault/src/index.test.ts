import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Nocap as Base } from '@nostrwatch/nocap';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cross-fetch', () => ({ fetch: fetchMock, default: fetchMock }));

import { GeoAdapterDefault } from './index';
// @ts-expect-error Legacy JS entry intentionally has no declaration file.
import LegacyGeoAdapterDefault from '../index.js';

describe('GeoAdapterDefault remote fetch policy', () => {
	beforeEach(() => {
		fetchMock.mockReset();
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ countryCode: 'ZZ', query: '127.0.0.1', status: 'success' }), {
				headers: { 'content-type': 'application/json' }
			})
		);
	});

	it('rejects redirects and omits ambient browser credentials', async () => {
		const base = {
			url: 'wss://relay.example',
			config: {},
			logger: { debug: vi.fn(), error: vi.fn() },
			finish: vi.fn()
		} as unknown as Base;

		await new GeoAdapterDefault(base).getGeoData('127.0.0.1');

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('ip-api.com/json/127.0.0.1'),
			expect.objectContaining({
				redirect: 'error',
				credentials: 'omit',
				referrerPolicy: 'no-referrer',
				cache: 'no-store'
			})
		);
	});

	it('applies the same redirect policy in the shipped legacy adapter', async () => {
		const base = {
			config: { adapterOptions: { geo: {} } },
			controller: new AbortController(),
			logger: { debug: vi.fn(), error: vi.fn() }
		};

		await new LegacyGeoAdapterDefault(base).getGeoData('127.0.0.1');

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('ip-api.com/json/127.0.0.1'),
			expect.objectContaining({
				redirect: 'error',
				credentials: 'omit',
				referrerPolicy: 'no-referrer',
				cache: 'no-store'
			})
		);
	});
});
