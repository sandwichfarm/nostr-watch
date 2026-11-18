import { describe, expect, it, vi } from 'vitest';

import { createRemoteFetch } from './remote-fetch';
import { publicImageUrl, safeImageUrl } from './sanitize';

const LOCAL = [
	'http://localhost:8765/',
	'http://127.0.0.1/icon.png',
	'http://2130706433/icon.png',
	'https://192.168.1.1/icon.png',
	'https://10.0.0.2/icon.png',
	'http://[::1]/icon.png',
	'https://nas.local/icon.png'
];

describe('local network blocking', () => {
	it.each(LOCAL)('safeImageUrl rejects %s', (url) => {
		expect(safeImageUrl(url)).toBe('');
	});

	it.each(LOCAL)('publicImageUrl rejects %s', (url) => {
		expect(publicImageUrl(url)).toBeUndefined();
	});

	it('image helpers still accept public and data URLs', () => {
		expect(safeImageUrl('https://example.org/a.png?x=1&y=2')).toBe(
			'https://example.org/a.png?x=1&amp;y=2'
		);
		expect(publicImageUrl('https://example.org/a.png?x=1&y=2')).toBe(
			'https://example.org/a.png?x=1&y=2'
		);
		expect(publicImageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
		expect(publicImageUrl('javascript:alert(1)')).toBeUndefined();
		expect(publicImageUrl(undefined)).toBeUndefined();
	});

	it.each(LOCAL)('remote fetch refuses %s before reaching the service worker', async (url) => {
		const register = vi.fn();
		const fetchRemote = createRemoteFetch({ serviceWorkerContainer: { register } as any });
		await expect(fetchRemote(url)).rejects.toThrow(/local or private network/);
		expect(register).not.toHaveBeenCalled();
	});
});
