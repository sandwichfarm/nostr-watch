import { afterEach, describe, expect, it, vi } from 'vitest';

import { nip11sLocal } from '$lib/stores/nip11s-local';

import { Nip11Service } from './index';

describe('Nip11Service', () => {
	afterEach(() => {
		nip11sLocal.set(new Map());
		vi.unstubAllGlobals();
	});

	it('creates worker for arbitrary automatic relay probes', async () => {
		const instances: Array<{ postMessage: ReturnType<typeof vi.fn> }> = [];

		class WorkerStub {
			onmessage: ((message: MessageEvent) => void) | null = null;
			onerror: ((event: Event) => void) | null = null;
			postMessage = vi.fn();

			constructor() {
				instances.push({ postMessage: this.postMessage });
			}
		}

		vi.stubGlobal('Worker', WorkerStub);

		const service = new Nip11Service();
		const pending = service.check('wss://attacker.example/', { timeoutMs: 20 });

		await vi.waitFor(() => {
			expect(instances[0]?.postMessage).toHaveBeenCalledWith({
				relay: 'wss://attacker.example/',
				timeoutMs: 20
			});
		});
		await expect(pending).resolves.toBeUndefined();
	});
});
