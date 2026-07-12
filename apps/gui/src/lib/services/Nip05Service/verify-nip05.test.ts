import { describe, expect, it, vi } from 'vitest';

import { verifyNip05 } from './verify-nip05';

describe('hardened NIP-05 verification', () => {
	it('rejects hostile redirects without requesting their sentinel target', async () => {
		let sentinelHits = 0;
		const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
			if (init?.redirect !== 'error') {
				sentinelHits += 1;
				return new Response(JSON.stringify({ names: { alice: 'f'.repeat(64) } }), {
					headers: { 'content-type': 'application/json' }
				});
			}

			throw new TypeError('NetworkError when attempting to fetch resource.');
		});

		await expect(
			verifyNip05('f'.repeat(64), 'alice@redirect.example', { fetchImpl })
		).resolves.toBe(false);
		expect(sentinelHits).toBe(0);
	});

	it('aborts a NIP-05 request that exceeds its timeout', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
			await new Promise<void>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					reject(new DOMException('Aborted', 'AbortError'));
				});
			});
			throw new Error('unreachable');
		});

		await expect(
			verifyNip05('f'.repeat(64), 'alice@slow.example', {
				fetchImpl,
				timeoutMs: 10
			})
		).resolves.toBe(false);
		expect((fetchImpl.mock.calls[0]?.[1]?.signal as AbortSignal).aborted).toBe(true);
	});

	it('rejects oversized NIP-05 documents before accepting their names map', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				new Response(
					JSON.stringify({ names: { alice: 'f'.repeat(64) }, padding: 'x'.repeat(1024) }),
					{ headers: { 'content-type': 'application/json' } }
				)
			);

		await expect(
			verifyNip05('f'.repeat(64), 'alice@large.example', {
				fetchImpl,
				maxBodyBytes: 128
			})
		).resolves.toBe(false);
	});

	it('rejects HTML responses even when their body contains valid-looking JSON', async () => {
		const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ names: { alice: 'f'.repeat(64) } }), {
				headers: { 'content-type': 'text/html' }
			})
		);

		await expect(verifyNip05('f'.repeat(64), 'alice@html.example', { fetchImpl })).resolves.toBe(
			false
		);
	});
});
