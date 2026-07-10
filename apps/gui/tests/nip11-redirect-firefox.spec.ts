import { createHash } from 'node:crypto';
import http from 'node:http';
import { test } from '@playwright/test';

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
	server.on('upgrade', (req, socket) => {
		const key = req.headers['sec-websocket-key'];
		if (typeof key !== 'string') {
			socket.destroy();
			return;
		}

		const accept = createHash('sha1')
			.update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
			.digest('base64');
		socket.write(
			[
				'HTTP/1.1 101 Switching Protocols',
				'Upgrade: websocket',
				'Connection: Upgrade',
				`Sec-WebSocket-Accept: ${accept}`,
				'\r\n'
			].join('\r\n')
		);
	});

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Hostile server failed to bind.');

	try {
		const route = `/relays/ws/127.0.0.1:${address.port}/nip-11`;
		await page.goto(route);
		const initialFrameUrl = page.url();
		const startedAt = Date.now();
		while (nip11Hits === 0 && Date.now() - startedAt < 15_000) {
			await page.waitForTimeout(100);
		}
		if (nip11Hits === 0) {
			throw new Error(
				`NIP-11 endpoint was not requested; hits=${JSON.stringify(hits)}; page=${page.url()}`
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 100));

		const sentinelHits = hits['/sentinel'] ?? 0;
		if (sentinelHits !== 0) {
			throw new Error(
				`Sentinel was requested ${sentinelHits} time(s); hits=${JSON.stringify(hits)}`
			);
		}
		if (page.url() !== initialFrameUrl) {
			throw new Error(`Parent frame URL changed from ${initialFrameUrl} to ${page.url()}`);
		}
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	}
});
