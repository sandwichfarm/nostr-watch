import http from 'node:http';
import { expect, test } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'firefox', 'Firefox-only NIP-11 redirect repro');
test.setTimeout(60_000);

test('hostile NIP-11 302 does not follow sentinel or navigate parent frame', async ({ page }) => {
	const hits: Record<string, number> = {};
	let nip11Hits = 0;
	const server = http.createServer((req, res) => {
		const path = req.url ?? '/';
		hits[path] = (hits[path] ?? 0) + 1;

		if (path === '/sentinel') {
			res.writeHead(200, {
				'content-type': 'application/nostr+json',
				'access-control-allow-origin': '*'
			});
			res.end(JSON.stringify({ name: 'sentinel should not load' }));
			return;
		}

		const accept = Array.isArray(req.headers.accept)
			? req.headers.accept.join(',')
			: (req.headers.accept ?? '');
		if (!accept.includes('application/nostr+json')) {
			res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
			res.end('ok');
			return;
		}

		nip11Hits += 1;
		const address = server.address();
		if (!address || typeof address === 'string')
			throw new Error('Hostile server address unavailable.');
		res.writeHead(302, {
			location: `http://127.0.0.1:${address.port}/sentinel`,
			'access-control-allow-origin': '*'
		});
		res.end();
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Hostile server failed to bind.');

	try {
		const mainFrameNavigations: string[] = [];
		page.on('framenavigated', (frame) => {
			if (frame === page.mainFrame()) mainFrameNavigations.push(frame.url());
		});
		await page.goto('/unsupported');
		await page.waitForTimeout(500);
		mainFrameNavigations.length = 0;
		const initialFrameUrl = page.url();
		const errorCode = await page.evaluate(async (relay) => {
			const modulePath = '/src/lib/services/Nip11Service/fetch-relay-information.ts';
			const { fetchRelayInformation } = await import(/* @vite-ignore */ modulePath);
			try {
				await fetchRelayInformation(relay, { timeoutMs: 2_000 });
				return null;
			} catch (error) {
				return (error as { code?: string }).code ?? 'unknown';
			}
		}, `ws://127.0.0.1:${address.port}`);

		expect(errorCode).toBe('fetch-failed');
		expect(nip11Hits).toBe(1);
		expect(hits['/sentinel'] ?? 0).toBe(0);
		expect(mainFrameNavigations).toEqual([]);
		expect(page.url()).toBe(initialFrameUrl);
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	}
});
