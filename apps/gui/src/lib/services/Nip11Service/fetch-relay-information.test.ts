import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	createNip11FetchInit,
	fetchRelayInformation,
	relayUrlToNip11HttpUrl
} from './fetch-relay-information';

type TestServer = {
	url: string;
	close: () => Promise<void>;
	getHits: () => Record<string, number>;
};

const listen = async (handler: http.RequestListener): Promise<TestServer> => {
	const hits: Record<string, number> = {};
	const server = http.createServer((req, res) => {
		const path = req.url ?? '/';
		hits[path] = (hits[path] ?? 0) + 1;
		handler(req, res);
	});

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Failed to bind test server.');

	return {
		url: `http://127.0.0.1:${address.port}`,
		close: () =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			),
		getHits: () => ({ ...hits })
	};
};

const relayFor = (serverUrl: string, path = ''): string =>
	serverUrl.replace('http://', 'ws://') + path;

const responseWithoutContentType = (body: string): Response => {
	const response = new Response(body);
	response.headers.delete('content-type');
	return response;
};

describe('hardened NIP-11 fetch', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('converts only ws and wss relay URLs to HTTP NIP-11 URLs', () => {
		expect(relayUrlToNip11HttpUrl('ws://relay.example/path?x=1#ignored')).toBe(
			'http://relay.example/path?x=1'
		);
		expect(relayUrlToNip11HttpUrl('wss://relay.example/')).toBe('https://relay.example/');
		expect(() => relayUrlToNip11HttpUrl('https://relay.example/')).toThrow(/ws: or wss:/);
		expect(() => relayUrlToNip11HttpUrl('wss://user:pass@relay.example/')).toThrow(/credentials/);
	});

	it('sets defensive fetch options for every NIP-11 request', async () => {
		const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ name: 'valid relay' }), {
				headers: { 'content-type': 'application/nostr+json' }
			})
		);

		await expect(fetchRelayInformation('wss://relay.example/', { fetchImpl })).resolves.toEqual({
			name: 'valid relay'
		});

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0]!;
		expect(url).toBe('https://relay.example/');
		expect(init).toMatchObject({
			redirect: 'error',
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
			cache: 'no-store',
			headers: { Accept: 'application/nostr+json' }
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect(createNip11FetchInit(new AbortController().signal).redirect).toBe('error');
	});

	it('aborts hung fetches at the configured timeout', async () => {
		const fetchImpl = vi.fn<typeof fetch>((_url, init) => {
			return new Promise<Response>((_resolve, reject) => {
				(init?.signal as AbortSignal).addEventListener('abort', () => {
					reject(new DOMException('Aborted', 'AbortError'));
				});
			});
		});

		await expect(
			fetchRelayInformation('wss://relay.example/', { fetchImpl, timeoutMs: 10 })
		).rejects.toMatchObject({
			code: 'timeout'
		});
		expect((fetchImpl.mock.calls[0]?.[1]?.signal as AbortSignal).aborted).toBe(true);
	});

	it('enforces content-type compatibility and bounded JSON body parsing', async () => {
		await expect(
			fetchRelayInformation('wss://relay.example/', {
				fetchImpl: vi
					.fn<typeof fetch>()
					.mockResolvedValue(responseWithoutContentType(JSON.stringify({ name: 'legacy relay' })))
			})
		).resolves.toEqual({ name: 'legacy relay' });

		await expect(
			fetchRelayInformation('wss://relay.example/', {
				fetchImpl: vi
					.fn<typeof fetch>()
					.mockResolvedValue(
						new Response('{"name":"wrong type"}', { headers: { 'content-type': 'text/html' } })
					)
			})
		).rejects.toMatchObject({ code: 'invalid-content-type' });

		await expect(
			fetchRelayInformation('wss://relay.example/', {
				fetchImpl: vi
					.fn<typeof fetch>()
					.mockResolvedValue(responseWithoutContentType('<html></html>'))
			})
		).rejects.toMatchObject({ code: 'invalid-content-type' });

		await expect(
			fetchRelayInformation('wss://relay.example/', {
				maxBodyBytes: 8,
				fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
					new Response(JSON.stringify({ name: 'too large' }), {
						headers: { 'content-type': 'application/json' }
					})
				)
			})
		).rejects.toMatchObject({ code: 'oversize' });

		await expect(
			fetchRelayInformation('wss://relay.example/', {
				fetchImpl: vi
					.fn<typeof fetch>()
					.mockResolvedValue(
						new Response('{not json}', { headers: { 'content-type': 'application/json' } })
					)
			})
		).rejects.toMatchObject({ code: 'invalid-json' });

		await expect(
			fetchRelayInformation('wss://relay.example/', {
				fetchImpl: vi
					.fn<typeof fetch>()
					.mockResolvedValue(
						new Response('[]', { headers: { 'content-type': 'application/json' } })
					)
			})
		).rejects.toMatchObject({ code: 'invalid-response' });
	});

	it('rejects hostile 302 NIP-11 responses without following the sentinel URL', async () => {
		const server = await listen((req, res) => {
			if (req.url === '/sentinel') {
				res.writeHead(200, { 'content-type': 'application/nostr+json' });
				res.end(JSON.stringify({ name: 'sentinel' }));
				return;
			}

			res.writeHead(302, {
				location: `${server.url}/sentinel`,
				'access-control-allow-origin': '*'
			});
			res.end();
		});

		try {
			await expect(fetchRelayInformation(relayFor(server.url))).rejects.toMatchObject({
				code: 'fetch-failed'
			});
			expect(server.getHits()['/']).toBe(1);
			expect(server.getHits()['/sentinel'] ?? 0).toBe(0);
		} finally {
			await server.close();
		}
	});

	it('loads valid NIP-11 JSON from arbitrary untrusted local origins', async () => {
		const relayInfo = {
			name: 'untrusted local relay',
			description: 'Valid NIP-11 from an arbitrary origin',
			pubkey: '0'.repeat(64),
			supported_nips: [1, 11]
		};
		const server = await listen((_req, res) => {
			res.writeHead(200, {
				'content-type': 'application/nostr+json',
				'access-control-allow-origin': '*'
			});
			res.end(JSON.stringify(relayInfo));
		});

		try {
			await expect(fetchRelayInformation(relayFor(server.url))).resolves.toEqual(relayInfo);
			expect(server.getHits()['/']).toBe(1);
		} finally {
			await server.close();
		}
	});
});
