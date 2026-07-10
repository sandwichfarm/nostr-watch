import { expect, test } from '@playwright/test';

test('cached monitor data bypasses first-visit boot screen during resync', async ({ page }) => {
	let seedManifestRequests = 0;
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/seed/manifest.json') seedManifestRequests += 1;
	});

	await page.addInitScript(() => {
		localStorage.clear();
		localStorage.setItem('state:count:events:checks', '100');
		localStorage.setItem('state:_types', JSON.stringify({ 'state:count:events:checks': 'number' }));
	});

	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('#content-wrapper')).toBeVisible({ timeout: 15_000 });

	await expect(page.getByText('booting.', { exact: true })).toHaveCount(0);
	expect(seedManifestRequests).toBe(0);
});
