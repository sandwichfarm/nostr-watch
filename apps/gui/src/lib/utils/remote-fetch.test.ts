import { describe, expect, it, vi } from 'vitest';

import { createRemoteFetch } from './remote-fetch';

const messageChannel = () => {
	const port1 = {
		onmessage: null as ((event: MessageEvent) => void) | null,
		close: vi.fn()
	};
	const port2 = {
		postMessage: (data: unknown) => {
			queueMicrotask(() => port1.onmessage?.({ data } as MessageEvent));
		}
	};
	return { port1, port2 } as unknown as MessageChannel;
};

describe('remote fetch broker', () => {
	it('moves arbitrary-origin HTTP requests to the service worker message boundary', async () => {
		const nativeFetch = vi.spyOn(globalThis, 'fetch');
		const worker = {
			postMessage: vi.fn((request: any, ports: any[]) => {
				const body = new TextEncoder().encode('{"name":"isolated"}').buffer;
				ports[0].postMessage({
					requestId: request.requestId,
					ok: true,
					response: {
						body,
						headers: [['content-type', 'application/json']],
						status: 200,
						statusText: 'OK'
					}
				});
			})
		};
		const registration = { active: worker };
		const serviceWorkerContainer = {
			register: vi.fn().mockResolvedValue(registration),
			ready: Promise.resolve(registration)
		};
		const remoteFetch = createRemoteFetch({
			serviceWorkerContainer: serviceWorkerContainer as unknown as ServiceWorkerContainer,
			createMessageChannel: messageChannel,
			createRequestId: () => 'request-1'
		});

		const response = await remoteFetch('https://arbitrary.example/nip11', {
			headers: { Accept: 'application/nostr+json' }
		});

		expect(await response.json()).toEqual({ name: 'isolated' });
		expect(nativeFetch).not.toHaveBeenCalled();
		expect(serviceWorkerContainer.register).toHaveBeenCalledWith(
			'/remote-fetch-service-worker.js',
			{ scope: '/', updateViaCache: 'none' }
		);
		expect(worker.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'nostr-watch:remote-fetch:v1',
				requestId: 'request-1',
				url: 'https://arbitrary.example/nip11',
				accept: 'application/nostr+json'
			}),
			[expect.anything()]
		);

		nativeFetch.mockRestore();
	});
});
