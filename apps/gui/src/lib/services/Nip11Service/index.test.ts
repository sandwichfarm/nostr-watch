import { afterEach, describe, expect, it, vi } from 'vitest';

import { nip11sLocal } from '$lib/stores/nip11s-local';

import { Nip11Service } from './index';

describe('Nip11Service', () => {
	afterEach(() => {
		nip11sLocal.set(new Map());
		vi.unstubAllGlobals();
	});

	it('keeps automatic relay probes out of a tab-owned dedicated worker', async () => {
		const fetchRelay = vi.fn().mockResolvedValue({
			name: 'arbitrary relay',
			description: 'loaded through the isolated remote-fetch boundary'
		});
		vi.stubGlobal(
			'Worker',
			class {
				constructor() {
					throw new Error('Dedicated workers retain the owning tab id.');
				}
			}
		);

		const service = new Nip11Service(fetchRelay as any);
		const result = await service.check('wss://attacker.example/', { timeoutMs: 20 });

		expect(fetchRelay).toHaveBeenCalledWith('wss://attacker.example/', { timeoutMs: 20 });
		expect(result?.json).toMatchObject({ name: 'arbitrary relay' });
	});
});
