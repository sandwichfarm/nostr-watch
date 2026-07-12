import { describe, expect, it, vi } from 'vitest';
import { sanitizedHtml, setSanitizedHtml } from './sanitize';

const generatedYoutubeEmbed = (videoId = 'dQw4w9WgXcQ') =>
	`<iframe width="100%" height="auto" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;

describe('setSanitizedHtml', () => {
	it('uses native setHTML with an active-content deny list when available', () => {
		const node = document.createElement('div');
		const setHTML = vi.fn();
		Object.defineProperty(node, 'setHTML', { value: setHTML, configurable: true });

		setSanitizedHtml(node, '<p>safe</p>');

		expect(setHTML).toHaveBeenCalledOnce();
		expect(setHTML).toHaveBeenCalledWith(
			'<p>safe</p>',
			expect.objectContaining({
				sanitizer: expect.objectContaining({
					removeElements: expect.arrayContaining(['base', 'form', 'iframe', 'meta', 'script'])
				})
			})
		);
	});

	it('removes executable and navigation markup in the DOMPurify fallback', () => {
		const node = document.createElement('div');

		setSanitizedHtml(
			node,
			'<p>safe</p><script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://attacker.example"><iframe src="https://attacker.example"></iframe><img src="x" onerror="alert(1)">'
		);

		expect(node.querySelector('p')?.textContent).toBe('safe');
		expect(node.querySelector('script, meta, iframe')).toBeNull();
		expect(node.querySelector('img')?.hasAttribute('onerror')).toBe(false);
	});

	it('normalizes link targets after insertion', () => {
		const node = document.createElement('div');

		setSanitizedHtml(
			node,
			'<a id="blank" href="https://example.com" target="_blank">blank</a><a id="top" href="https://example.com" target="_top">top</a>'
		);

		expect(node.querySelector('#blank')?.getAttribute('rel')).toContain('noopener');
		expect(node.querySelector('#blank')?.getAttribute('rel')).toContain('noreferrer');
		expect(node.querySelector('#top')?.hasAttribute('target')).toBe(false);
	});

	it('reconstructs only app-generated sandboxed YouTube embeds', () => {
		const node = document.createElement('div');

		setSanitizedHtml(node, {
			html: `<p>before</p>${generatedYoutubeEmbed()}<p>after</p>`,
			allowYoutubeEmbeds: true
		});

		const iframe = node.querySelector('iframe');
		expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
		expect(iframe?.getAttribute('sandbox')).toBe(
			'allow-scripts allow-same-origin allow-presentation'
		);
		expect(iframe?.getAttribute('sandbox')).not.toContain('allow-top-navigation');
	});

	it('does not preserve arbitrary iframe input', () => {
		const node = document.createElement('div');

		setSanitizedHtml(node, {
			html: '<iframe src="https://attacker.example"></iframe>',
			allowYoutubeEmbeds: true
		});

		expect(node.querySelector('iframe')).toBeNull();
	});
});

describe('sanitizedHtml action', () => {
	it('re-sanitizes updates', () => {
		const node = document.createElement('div');
		const action = sanitizedHtml(node, '<p>first</p>');

		action.update('<p>second</p><script>alert(1)</script>');

		expect(node.textContent).toBe('second');
		expect(node.querySelector('script')).toBeNull();
	});
});
