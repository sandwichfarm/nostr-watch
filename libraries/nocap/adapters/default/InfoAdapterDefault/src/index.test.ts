import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import type { Nocap as Base, IResultData } from '@nostrwatch/nocap';
import { InfoAdapterDefault } from './index';
// @ts-expect-error Legacy JS entry intentionally has no declaration file.
import LegacyInfoAdapterDefault from '../index.js';

const listenRedirectServer = async () => {
	const hits: Record<string, number> = {};
	const server = http.createServer((req, res) => {
		const path = req.url ?? '/';
		hits[path] = (hits[path] ?? 0) + 1;
		if (path === '/sentinel') {
			res.writeHead(200, { 'content-type': 'application/nostr+json' });
			res.end(JSON.stringify({ name: 'redirect target' }));
			return;
		}

		res.writeHead(302, { location: '/sentinel' });
		res.end();
	});

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Failed to bind test server.');

	return {
		hits,
		url: `ws://127.0.0.1:${address.port}`,
		close: () =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			)
	};
};

describe('InfoAdapterDefault redirect handling', () => {
	it('fails a redirected relay-info request without following its sentinel target', async () => {
		const server = await listenRedirectServer();

		const finish = vi.fn<(check: string, result: IResultData) => void>();
		const base = {
			url: server.url,
			results: new Map([['network', 'clearnet']]),
			logger: { debug: vi.fn(), error: vi.fn() },
			finish
		} as unknown as Base;

		try {
			await new InfoAdapterDefault(base).check_info();
			expect(server.hits['/']).toBe(1);
			expect(server.hits['/sentinel'] ?? 0).toBe(0);
			expect(finish).toHaveBeenCalledWith(
				'info',
				expect.objectContaining({ status: 'error' })
			);
		} finally {
			await server.close();
		}
	});

	it('keeps the shipped legacy adapter from following relay-info redirects', async () => {
		const server = await listenRedirectServer();
		const finish = vi.fn();
		const base = {
			url: server.url,
			results: new Map([['network', 'clearnet']]),
			controller: new AbortController(),
			logger: { debug: vi.fn(), error: vi.fn() },
			finish
		};

		try {
			await new LegacyInfoAdapterDefault(base).check_info();
			expect(server.hits['/']).toBe(1);
			expect(server.hits['/sentinel'] ?? 0).toBe(0);
			expect(finish).toHaveBeenCalledWith(
				'info',
				expect.objectContaining({ status: 'error' })
			);
		} finally {
			await server.close();
		}
	});

	it('rejects HTML relay-info responses even when their body is valid JSON', async () => {
		const server = http.createServer((_req, res) => {
			res.writeHead(200, { 'content-type': 'text/html' });
			res.end(JSON.stringify({ name: 'not NIP-11 content' }));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Failed to bind test server.');

		const finish = vi.fn<(check: string, result: IResultData) => void>();
		const base = {
			url: `ws://127.0.0.1:${address.port}`,
			results: new Map([['network', 'clearnet']]),
			logger: { debug: vi.fn(), error: vi.fn() },
			finish
		} as unknown as Base;

		try {
			await new InfoAdapterDefault(base).check_info();
			expect(finish).toHaveBeenCalledWith(
				'info',
				expect.objectContaining({ status: 'error' })
			);
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});

	it('rejects HTML relay-info responses in the shipped legacy adapter', async () => {
		const server = http.createServer((_req, res) => {
			res.writeHead(200, { 'content-type': 'text/html' });
			res.end(JSON.stringify({ name: 'not NIP-11 content' }));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Failed to bind test server.');

		const finish = vi.fn();
		const base = {
			url: `ws://127.0.0.1:${address.port}`,
			results: new Map([['network', 'clearnet']]),
			controller: new AbortController(),
			logger: { debug: vi.fn(), error: vi.fn() },
			finish
		};

		try {
			await new LegacyInfoAdapterDefault(base).check_info();
			expect(finish).toHaveBeenCalledWith(
				'info',
				expect.objectContaining({ status: 'error' })
			);
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});

	it('rejects oversized relay-info documents', async () => {
		const server = http.createServer((_req, res) => {
			res.writeHead(200, { 'content-type': 'application/nostr+json' });
			res.end(JSON.stringify({ name: 'large', padding: 'x'.repeat(200 * 1024) }));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Failed to bind test server.');

		const finish = vi.fn<(check: string, result: IResultData) => void>();
		const base = {
			url: `ws://127.0.0.1:${address.port}`,
			results: new Map([['network', 'clearnet']]),
			logger: { debug: vi.fn(), error: vi.fn() },
			finish
		} as unknown as Base;

		try {
			await new InfoAdapterDefault(base).check_info();
			expect(finish).toHaveBeenCalledWith(
				'info',
				expect.objectContaining({ status: 'error' })
			);
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});

	it('rejects oversized relay-info documents in the shipped legacy adapter', async () => {
		const server = http.createServer((_req, res) => {
			res.writeHead(200, { 'content-type': 'application/nostr+json' });
			res.end(JSON.stringify({ name: 'large', padding: 'x'.repeat(200 * 1024) }));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Failed to bind test server.');

		const finish = vi.fn();
		const base = {
			url: `ws://127.0.0.1:${address.port}`,
			results: new Map([['network', 'clearnet']]),
			controller: new AbortController(),
			logger: { debug: vi.fn(), error: vi.fn() },
			finish
		};

		try {
			await new LegacyInfoAdapterDefault(base).check_info();
			expect(finish).toHaveBeenCalledWith(
				'info',
				expect.objectContaining({ status: 'error' })
			);
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
		}
	});
});
