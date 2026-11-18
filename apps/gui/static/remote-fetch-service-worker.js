const REMOTE_FETCH_MESSAGE = 'nostr-watch:remote-fetch:v1';
const MAX_BROKER_BODY_BYTES = 1024 * 1024;
const MAX_BROKER_TIMEOUT_MS = 30_000;

self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

const boundedInteger = (value, fallback, maximum) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.min(Math.floor(parsed), maximum);
};

const readBoundedBody = async (response, maximumBytes) => {
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
		throw new Error(`Remote response exceeds ${maximumBytes} bytes.`);
	}

	if (!response.body) return new ArrayBuffer(0);

	const reader = response.body.getReader();
	const chunks = [];
	let total = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;

			total += value.byteLength;
			if (total > maximumBytes) {
				await reader.cancel();
				throw new Error(`Remote response exceeds ${maximumBytes} bytes.`);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body.buffer;
};

// Inline copy of isLocalNetworkHost from @nostrwatch/utils (internal/utils/src/network.ts);
// this file is served as-is and cannot import it. Keep the two in sync.
const LOCAL_HOST_SUFFIXES = [
	'.localhost',
	'.local',
	'.localdomain',
	'.lan',
	'.internal',
	'.intranet',
	'.home.arpa'
];
const isLocalIpv4 = ([a, b]) =>
	a === 0 ||
	a === 127 ||
	a === 10 ||
	(a === 172 && b >= 16 && b <= 31) ||
	(a === 192 && b === 168) ||
	(a === 169 && b === 254) ||
	(a === 100 && b >= 64 && b <= 127);
const isLocalIpv6 = (address) => {
	if (address === '::' || address === '::1') return true;
	const mapped = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
	if (mapped) {
		const hi = parseInt(mapped[1], 16);
		const lo = parseInt(mapped[2], 16);
		return isLocalIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
	}
	const first = parseInt(address.split(':')[0] || '0', 16);
	return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
};
const isLocalNetworkHost = (rawHostname) => {
	const hostname = rawHostname.toLowerCase().replace(/\.$/, '');
	if (!hostname) return true;
	if (hostname.startsWith('[') && hostname.endsWith(']')) return isLocalIpv6(hostname.slice(1, -1));
	if (hostname.includes(':')) return isLocalIpv6(hostname);
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
	if (m) return isLocalIpv4(m.slice(1).map(Number));
	if (hostname === 'localhost') return true;
	return LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
};

const fetchRemote = async (request) => {
	const url = new URL(request.url);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Only HTTP(S) remote resources are supported.');
	}
	if (isLocalNetworkHost(url.hostname)) {
		throw new Error('Requests to local or private network addresses are blocked.');
	}

	const timeoutMs = boundedInteger(request.timeoutMs, 15_000, MAX_BROKER_TIMEOUT_MS);
	const maxBodyBytes = boundedInteger(
		request.maxBodyBytes,
		MAX_BROKER_BODY_BYTES,
		MAX_BROKER_BODY_BYTES
	);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	const headers = new Headers();
	if (typeof request.accept === 'string' && request.accept.length <= 256) {
		headers.set('accept', request.accept);
	}

	try {
		const response = await fetch(url, {
			method: 'GET',
			redirect: 'error',
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
			cache: 'no-store',
			headers,
			signal: controller.signal
		});
		if (response.redirected) throw new Error('Remote redirects are not allowed.');

		const body = await readBoundedBody(response, maxBodyBytes);
		return {
			requestId: request.requestId,
			ok: true,
			response: {
				body,
				headers: Array.from(response.headers.entries()),
				status: response.status,
				statusText: response.statusText
			}
		};
	} finally {
		clearTimeout(timeout);
	}
};

self.addEventListener('message', (event) => {
	const request = event.data;
	const port = event.ports?.[0];
	if (request?.type !== REMOTE_FETCH_MESSAGE || !port) return;

	event.waitUntil(
		fetchRemote(request)
			.then((message) => port.postMessage(message, [message.response.body]))
			.catch((error) => {
				port.postMessage({
					requestId: request.requestId,
					ok: false,
					error: {
						name: error instanceof Error ? error.name : 'Error',
						message: error instanceof Error ? error.message : String(error)
					}
				});
			})
	);
});
