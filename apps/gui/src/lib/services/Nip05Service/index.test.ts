import { afterEach, describe, expect, it, vi } from 'vitest';

import { nip05s } from '$lib/stores/nip05s';

import { Nip05Service } from './index';

describe('Nip05Service', () => {
	afterEach(() => {
		nip05s.set(new Map());
		vi.unstubAllGlobals();
	});

	it('keeps arbitrary NIP-05 probes out of a tab-owned dedicated worker', async () => {
		const verify = vi.fn().mockResolvedValue(true);
		vi.stubGlobal(
			'Worker',
			class {
				constructor() {
					throw new Error('Dedicated workers retain the owning tab id.');
				}
			}
		);

		const service = new Nip05Service(verify as any);
		const result = await service.check('0'.repeat(64), 'alice@example.com' as any, {
			timeoutMs: 20
		});

		expect(verify).toHaveBeenCalledWith('0'.repeat(64), 'alice@example.com', {
			timeoutMs: 20
		});
		expect(result.valid).toBe(true);
	});
});
