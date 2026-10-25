const REMOTE_FETCH_MESSAGE = 'nostr-watch:remote-fetch:v1';
const SERVICE_WORKER_URL = '/remote-fetch-service-worker.js';
const BROKER_TIMEOUT_MS = 35_000;
const MAX_BROKER_BODY_BYTES = 1024 * 1024;

type RemoteFetchResponse = {
	requestId: string;
	ok: true;
	response: {
		body: ArrayBuffer;
		headers: Array<[string, string]>;
		status: number;
		statusText: string;
	};
};

type RemoteFetchError = {
	requestId: string;
	ok: false;
	error: {
		name: string;
		message: string;
	};
};

type RemoteFetchMessage = RemoteFetchResponse | RemoteFetchError;

export type RemoteFetchEnvironment = {
	serviceWorkerContainer?: ServiceWorkerContainer;
	createMessageChannel?: () => MessageChannel;
	createRequestId?: () => string;
};

const abortError = (): Error => {
	if (typeof DOMException === 'function') return new DOMException('Aborted', 'AbortError');
	const error = new Error('Aborted');
	error.name = 'AbortError';
	return error;
};

const resolveUrl = (input: RequestInfo | URL): URL => {
	if (input instanceof URL) return input;
	if (typeof input === 'string') return new URL(input, globalThis.location?.href);
	return new URL(input.url);
};

export const createRemoteFetch = (environment: RemoteFetchEnvironment = {}): typeof fetch => {
	let activeWorkerPromise: Promise<ServiceWorker> | null = null;

	const activeWorker = async (): Promise<ServiceWorker> => {
		if (activeWorkerPromise) return activeWorkerPromise;

		const registrationPromise = (async () => {
			const container =
				environment.serviceWorkerContainer ??
				(typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined);
			if (!container) throw new Error('The remote-fetch service worker is unavailable.');

			const registration = await container.register(SERVICE_WORKER_URL, {
				scope: '/',
				updateViaCache: 'none'
			});
			const ready = await container.ready;
			const worker = ready.active ?? registration.active;
			if (!worker) throw new Error('The remote-fetch service worker is not active.');
			return worker;
		})();
		activeWorkerPromise = registrationPromise.catch((error) => {
			activeWorkerPromise = null;
			throw error;
		});

		return activeWorkerPromise;
	};

	return async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
		const url = resolveUrl(input);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new TypeError('Only HTTP(S) remote resources are supported.');
		}
		if (init.method && init.method.toUpperCase() !== 'GET') {
			throw new TypeError('The remote-fetch broker only supports GET requests.');
		}
		if (init.signal?.aborted) throw abortError();

		const worker = await activeWorker();
		if (init.signal?.aborted) throw abortError();
		const channel = (environment.createMessageChannel ?? (() => new MessageChannel()))();
		const requestId =
			environment.createRequestId?.() ??
			(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random()}`);
		const headers = new Headers(init.headers);

		const message = await new Promise<RemoteFetchMessage>((resolve, reject) => {
			const cleanup = () => {
				clearTimeout(timeout);
				init.signal?.removeEventListener('abort', onAbort);
				channel.port1.close();
			};
			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error('The remote-fetch service worker timed out.'));
			}, BROKER_TIMEOUT_MS);
			const onAbort = () => {
				cleanup();
				reject(abortError());
			};

			channel.port1.onmessage = (event: MessageEvent<RemoteFetchMessage>) => {
				if (event.data?.requestId !== requestId) return;
				cleanup();
				resolve(event.data);
			};
			init.signal?.addEventListener('abort', onAbort, { once: true });
			try {
				worker.postMessage(
					{
						type: REMOTE_FETCH_MESSAGE,
						requestId,
						url: url.href,
						accept: headers.get('accept') ?? undefined,
						maxBodyBytes: MAX_BROKER_BODY_BYTES,
						timeoutMs: BROKER_TIMEOUT_MS - 5_000
					},
					[channel.port2]
				);
			} catch (error) {
				cleanup();
				reject(error);
			}
		});

		if (!message.ok) {
			const error = new TypeError(message.error.message);
			error.name = message.error.name;
			throw error;
		}

		return new Response(message.response.body, {
			status: message.response.status,
			statusText: message.response.statusText,
			headers: message.response.headers
		});
	};
};

export const fetchRemote = createRemoteFetch();
