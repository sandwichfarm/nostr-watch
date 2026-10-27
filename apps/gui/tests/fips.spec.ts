import { expect, test, type Page } from '@playwright/test';

async function seedFips(page: Page) {
	await page.evaluate(async () => {
		const load = new Function('path', 'return import(path)');
		const { events } = await load('/src/lib/stores/events.ts');
		const { monitorsMap } = await load('/src/lib/stores/monitors.ts');
		const { Nip66CheckEvent, Monitor } = await load(
			'/node_modules/@nostrwatch/route66/dist/browser/models/index.esm.js'
		);
		const { useWorkerRelayChecks } = await load('/src/lib/stores/dimension-stores.ts');
		const { doLiveSync, doAggregateCache } = await load('/src/lib/stores/app.ts');
		doLiveSync.set(false);
		doAggregateCache.set(true);
		useWorkerRelayChecks.set(true);
		const pubkey = 'a'.repeat(64);
		const created_at = Math.floor(Date.now() / 1000);
		const template = { pubkey, created_at, sig: '0'.repeat(128), content: '', tags: [] };
		const monitor = new Monitor({
			...template,
			id: '1'.repeat(64),
			kind: 10166,
			tags: [
				['frequency', '600'],
				['n', 'fips'],
				['n', 'tor'],
				['n', 'i2p'],
				['c', 'open'],
				['c', 'read']
			]
		});
		monitor.addProfile({
			...template,
			id: '2'.repeat(64),
			kind: 0,
			content: JSON.stringify({
				name: 'FIPS fixture monitor',
				about: 'Host-routed mesh monitoring'
			})
		});
		monitor.enabled = true;
		monitor.lastActive = created_at;
		monitorsMap.set(new Map([[pubkey, monitor]]));
		const checks = ['fips', 'clearnet'].map(
			(network, index) =>
				new Nip66CheckEvent({
					...template,
					id: String(index + 3).repeat(64),
					kind: 30166,
					content: JSON.stringify({ name: `${network} fixture relay`, supported_nips: [1, 11] }),
					tags: [
						['d', network === 'fips' ? 'ws://relay.fips:7777/' : 'wss://relay.example.org/'],
						['n', network],
						['rtt-open', String(42 + index * 20)]
					]
				})
		);
		events.set(new Map(checks.map((event: any) => [event.id, event])));
	});
}

test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.addInitScript(() => {
		// Keep UI fixtures independent of public relay traffic. A closed socket
		// also avoids Firefox's driver race when live sync closes during opening.
		class OfflineSocket extends EventTarget {
			readonly readyState = 3;
			readonly bufferedAmount = 0;
			readonly protocol = '';
			readonly extensions = '';
			binaryType = 'blob';
			onclose: ((event: CloseEvent) => void) | null = null;
			constructor(readonly url: string) {
				super();
				queueMicrotask(() => {
					const event = new CloseEvent('close', { code: 1000 });
					this.dispatchEvent(event);
					this.onclose?.(event);
				});
			}
			send() {
				throw new Error('External WebSockets are disabled in the UI fixture');
			}
			close() {}
		}
		window.WebSocket = new Proxy(window.WebSocket, {
			construct(_target, args) {
				return new OfflineSocket(String(args[0]));
			}
		});
		// Route66's transport runs in an inline worker. Apply the same offline
		// socket boundary there while keeping real workers and aggregation intact.
		const offlineSource = `const OfflineSocket = ${OfflineSocket.toString()}; globalThis.WebSocket = new Proxy(globalThis.WebSocket, { construct: (_target, args) => new OfflineSocket(String(args[0])) });\n`;
		window.Blob = new Proxy(window.Blob, {
			construct(target, args) {
				if (String(args[1]?.type).includes('javascript')) {
					return Reflect.construct(target, [[offlineSource, ...(args[0] ?? [])], args[1]]);
				}
				return Reflect.construct(target, args);
			}
		});
		localStorage.clear();
		localStorage.setItem('state:count:events:checks', '2');
		const pubkey = 'a'.repeat(64);
		const created_at = Math.floor(Date.now() / 1000);
		const template = { pubkey, created_at, sig: '0'.repeat(128), content: '' };
		localStorage.setItem(
			'state:cache:monitors',
			JSON.stringify([
				{
					pubkey,
					enabled: true,
					priority: 0,
					lastActive: created_at,
					registration: {
						...template,
						id: '1'.repeat(64),
						kind: 10166,
						tags: [
							['frequency', '600'],
							['n', 'fips'],
							['n', 'tor'],
							['n', 'i2p'],
							['c', 'open'],
							['c', 'read']
						]
					},
					profile: {
						...template,
						id: '2'.repeat(64),
						kind: 0,
						tags: [],
						content: JSON.stringify({
							name: 'FIPS fixture monitor',
							about: 'Host-routed mesh monitoring'
						})
					}
				}
			])
		);
		localStorage.setItem(
			'state:_types',
			JSON.stringify({
				'state:count:events:checks': 'number',
				'state:cache:monitors': 'object'
			})
		);
	});
});

test('FIPS relay icon, filter, and details render alongside clearnet', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await expect(page.locator('#content-wrapper')).toBeVisible();
	await expect(page.getByRole('button', { name: 'columns', exact: true })).toBeVisible();
	await seedFips(page);
	await page.waitForFunction(() =>
		[...document.querySelectorAll('tbody tr')].some((row) =>
			row.textContent?.includes('relay.fips:7777')
		)
	);
	const row = page.getByRole('row').filter({ hasText: 'relay.fips:7777' });
	await expect(row).toBeVisible({ timeout: 15000 });
	await expect(row.getByRole('img', { name: 'FIPS', exact: true })).toBeVisible();
	await expect(page.getByRole('row').filter({ hasText: 'relay.example.org' })).toBeVisible();
	const icon = await page.request.get('/icon/network/fips-dark.svg');
	expect(icon.ok()).toBe(true);
	await page.screenshot({
		path: testInfo.outputPath('fips-relays.png'),
		fullPage: true,
		animations: 'disabled'
	});
	const expand = page.getByRole('button', { name: '⭅', exact: true });
	if (await expand.isVisible()) await expand.click();
	await page.getByRole('button', { name: /^network$/i }).click();
	await page.getByText('fips', { exact: true }).click();
	await expect(row).toBeVisible();
	await expect(page.getByRole('row').filter({ hasText: 'relay.example.org' })).toHaveCount(0);
	await page.screenshot({
		path: testInfo.outputPath('fips-filter.png'),
		fullPage: true,
		animations: 'disabled'
	});
	await row.getByRole('link').first().click();
	await expect(page).toHaveURL(/relay\.fips/);
	await page.getByRole('link', { name: 'Checks', exact: true }).click();
	await expect(page.getByRole('cell', { name: 'fips', exact: true })).toBeVisible();
	await page.waitForFunction(() => {
		const cell = [...document.querySelectorAll('td')].find(
			(element) => element.textContent === 'fips'
		);
		if (!cell) return false;
		for (let element: Element | null = cell; element; element = element.parentElement) {
			if (Number(getComputedStyle(element).opacity) < 0.99) return false;
		}
		return true;
	});
	await page.screenshot({
		path: testInfo.outputPath('fips-detail.png'),
		fullPage: true,
		animations: 'disabled'
	});
});

test('monitor advertises FIPS beside Tor and I2P', async ({ page }, testInfo) => {
	test.setTimeout(60000);
	await page.goto('/monitors');
	await expect(page.locator('#content-wrapper')).toBeVisible();
	await expect(page.getByRole('button', { name: 'columns', exact: true })).toBeVisible({
		timeout: 30000
	});
	await seedFips(page);
	const row = page.getByRole('row').filter({ hasText: 'FIPS fixture monitor' });
	await expect(row).toBeVisible();
	await expect(row).toContainText('fips');
	await expect(row).toContainText('tor');
	await expect(row).toContainText('i2p');
	await page.screenshot({
		path: testInfo.outputPath('fips-monitor.png'),
		fullPage: true,
		animations: 'disabled'
	});
});
