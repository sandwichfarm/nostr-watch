import { expect, test } from '@playwright/test';

test.skip(
	({ browserName }) => browserName !== 'firefox',
	'Firefox 148+ native Sanitizer API regression'
);

test('formatted HTML uses native setHTML without retaining active navigation', async ({ page }) => {
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	const result = await page.evaluate(async () => {
		type NativeSetHTML = (
			input: string,
			options?: { sanitizer: { removeElements: string[] } }
		) => void;
		type SanitizingPrototype = Element & { setHTML?: NativeSetHTML };
		type SanitizeModule = {
			setSanitizedHtml(node: HTMLElement, value: unknown): void;
		};

		const prototype = Element.prototype as SanitizingPrototype;
		const nativeSetHTML = prototype.setHTML;
		if (typeof nativeSetHTML !== 'function') {
			return { supported: false, nativeCalls: 0 };
		}

		let nativeCalls = 0;
		prototype.setHTML = function (input, options) {
			nativeCalls += 1;
			return nativeSetHTML.call(this, input, options);
		};

		try {
			const importModule = new Function('path', 'return import(path)') as (
				path: string
			) => Promise<SanitizeModule>;
			const { setSanitizedHtml } = await importModule('/src/lib/utils/sanitize.ts');
			const node = document.createElement('div');
			document.body.append(node);

			setSanitizedHtml(
				node,
				'<p>safe</p>' +
					'<script>location="https://xyz.ngrok.pro"</script>' +
					'<meta http-equiv="refresh" content="0;url=https://xyz.ngrok.pro">' +
					'<iframe src="https://xyz.ngrok.pro"></iframe>' +
					'<img src="x" onerror="location=\'https://xyz.ngrok.pro\'">' +
					'<a id="escape" href="https://xyz.ngrok.pro" target="_top">escape</a>'
			);

			return {
				supported: true,
				nativeCalls,
				text: node.querySelector('p')?.textContent,
				activeContent: node.querySelectorAll('script, meta, iframe').length,
				eventHandler: node.querySelector('img')?.hasAttribute('onerror'),
				topTarget: node.querySelector('#escape')?.hasAttribute('target'),
				location: window.location.href
			};
		} finally {
			prototype.setHTML = nativeSetHTML;
		}
	});

	expect(result.supported).toBe(true);
	expect(result.nativeCalls).toBe(1);
	expect(result.text).toBe('safe');
	expect(result.activeContent).toBe(0);
	expect(result.eventHandler).toBe(false);
	expect(result.topTarget).toBe(false);
	expect(result.location).toContain('localhost:5173');
});
