import { expect, test } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'firefox', 'Firefox-only NIP-05 redirect repro');

test('hostile NIP-05 302 does not follow sentinel or navigate parent frame', async ({ page }) => {
	let sourceHits = 0;
	let sentinelHits = 0;
	const mainFrameNavigations: string[] = [];
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) mainFrameNavigations.push(frame.url());
	});

	await page.route('https://redirect.example/**', async (route) => {
		sourceHits += 1;
		await route.fulfill({
			status: 302,
			headers: {
				location: 'https://sentinel.example/captured',
				'access-control-allow-origin': '*'
			}
		});
	});
	await page.route('https://sentinel.example/**', async (route) => {
		sentinelHits += 1;
		await route.fulfill({
			status: 200,
			headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
			body: JSON.stringify({ names: { alice: 'f'.repeat(64) } })
		});
	});

	await page.goto('/unsupported');
	await page.waitForTimeout(500);
	mainFrameNavigations.length = 0;
	const initialFrameUrl = page.url();
	const valid = await page.evaluate(async (pubkey) => {
		const modulePath = '/src/lib/services/Nip05Service/verify-nip05.ts';
		const { verifyNip05 } = await import(/* @vite-ignore */ modulePath);
		return verifyNip05(pubkey, 'alice@redirect.example', { timeoutMs: 2_000 });
	}, 'f'.repeat(64));

	expect(valid).toBe(false);
	expect(sourceHits).toBe(1);
	expect(sentinelHits).toBe(0);
	expect(mainFrameNavigations).toEqual([]);
	expect(page.url()).toBe(initialFrameUrl);
});

test('valid NIP-05 JSON from an arbitrary origin still verifies', async ({ page }) => {
	await page.route('https://untrusted.example/**', async (route) => {
		await route.fulfill({
			status: 200,
			headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
			body: JSON.stringify({ names: { alice: 'a'.repeat(64) } })
		});
	});

	await page.goto('/unsupported');
	await page.waitForTimeout(500);
	const valid = await page.evaluate(async (pubkey) => {
		const modulePath = '/src/lib/services/Nip05Service/verify-nip05.ts';
		const { verifyNip05 } = await import(/* @vite-ignore */ modulePath);
		return verifyNip05(pubkey, 'alice@untrusted.example', { timeoutMs: 2_000 });
	}, 'a'.repeat(64));

	expect(valid).toBe(true);
});
