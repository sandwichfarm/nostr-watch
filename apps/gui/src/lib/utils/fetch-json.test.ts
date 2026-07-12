import { describe, expect, it, vi } from 'vitest';

import { fetchJsonResource } from './fetch-json';

describe('browser JSON resource fetch policy', () => {
	it('rejects redirects and omits ambient browser credentials', async () => {
		const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ version: 1 }), {
				headers: { 'content-type': 'application/json' }
			})
		);

		await expect(
			fetchJsonResource<{ version: number }>('https://seed.example/manifest.json', { fetchImpl })
		).resolves.toEqual({ version: 1 });
		expect(fetchImpl).toHaveBeenCalledWith(
			'https://seed.example/manifest.json',
			expect.objectContaining({
				redirect: 'error',
				credentials: 'omit',
				referrerPolicy: 'no-referrer'
			})
		);
	});
});
