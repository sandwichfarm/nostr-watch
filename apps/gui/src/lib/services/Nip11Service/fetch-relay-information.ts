import type { RelayInformation } from '@nostrwatch/route66/models';

export const NIP11_ACCEPT = 'application/nostr+json';
export const NIP11_MAX_BODY_BYTES = 128 * 1024;
export const NIP11_TIMEOUT_MS = 5_000;

export type Nip11FetchErrorCode =
	| 'invalid-relay-url'
	| 'timeout'
	| 'fetch-failed'
	| 'http-error'
	| 'invalid-content-type'
	| 'oversize'
	| 'invalid-json'
	| 'invalid-response';

export type SerializedNip11FetchError = {
	code: Nip11FetchErrorCode;
	message: string;
	status?: number;
};

export class Nip11FetchError extends Error {
	code: Nip11FetchErrorCode;
	status?: number;

	constructor(code: Nip11FetchErrorCode, message: string, status?: number) {
		super(message);
		this.name = 'Nip11FetchError';
		this.code = code;
		this.status = status;
	}
}

export type FetchRelayInformationOptions = {
	timeoutMs?: number;
	maxBodyBytes?: number;
	fetchImpl?: typeof fetch;
};

export const relayUrlToNip11HttpUrl = (relay: string): string => {
	let url: URL;
	try {
		url = new URL(relay);
	} catch {
		throw new Nip11FetchError('invalid-relay-url', `Invalid relay URL: ${relay}`);
	}

	if (url.username || url.password) {
		throw new Nip11FetchError('invalid-relay-url', 'Relay URL must not contain credentials.');
	}

	if (url.protocol === 'ws:') {
		url.protocol = 'http:';
	} else if (url.protocol === 'wss:') {
		url.protocol = 'https:';
	} else {
		throw new Nip11FetchError(
			'invalid-relay-url',
			`Relay URL must use ws: or wss:, got ${url.protocol}`
		);
	}

	url.hash = '';
	return url.toString();
};

export const createNip11FetchInit = (signal: AbortSignal): RequestInit => ({
	redirect: 'error',
	credentials: 'omit',
	referrerPolicy: 'no-referrer',
	cache: 'no-store',
	headers: {
		Accept: NIP11_ACCEPT
	},
	signal
});

const isJsonContentType = (contentType: string): boolean => {
	const mime = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	return (
		mime === NIP11_ACCEPT ||
		mime === 'application/json' ||
		mime === 'text/json' ||
		mime.endsWith('+json')
	);
};

const startsLikeJsonObject = (body: string): boolean => body.trimStart().startsWith('{');

const bytesFor = (text: string): number => new TextEncoder().encode(text).byteLength;

const readBodyWithLimit = async (response: Response, maxBodyBytes: number): Promise<string> => {
	const contentLength = response.headers.get('content-length');
	if (contentLength) {
		const parsedLength = Number(contentLength);
		if (Number.isFinite(parsedLength) && parsedLength > maxBodyBytes) {
			throw new Nip11FetchError('oversize', `NIP-11 response exceeds ${maxBodyBytes} bytes.`);
		}
	}

	if (!response.body) {
		const text = await response.text();
		if (bytesFor(text) > maxBodyBytes) {
			throw new Nip11FetchError('oversize', `NIP-11 response exceeds ${maxBodyBytes} bytes.`);
		}
		return text;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;

		const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
		received += chunk.byteLength;
		if (received > maxBodyBytes) {
			await reader.cancel();
			throw new Nip11FetchError('oversize', `NIP-11 response exceeds ${maxBodyBytes} bytes.`);
		}
		chunks.push(chunk);
	}

	const body = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder().decode(body);
};

const parseRelayInformation = (body: string): RelayInformation => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new Nip11FetchError('invalid-json', 'NIP-11 response body is not valid JSON.');
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Nip11FetchError('invalid-response', 'NIP-11 response must be a JSON object.');
	}

	return parsed as RelayInformation;
};

export const fetchRelayInformation = async (
	relay: string,
	options: FetchRelayInformationOptions = {}
): Promise<RelayInformation> => {
	const url = relayUrlToNip11HttpUrl(relay);
	const timeoutMs = options.timeoutMs ?? NIP11_TIMEOUT_MS;
	const maxBodyBytes = options.maxBodyBytes ?? NIP11_MAX_BODY_BYTES;
	const fetchImpl = options.fetchImpl ?? fetch;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetchImpl(url, createNip11FetchInit(controller.signal));
		if (!response.ok) {
			throw new Nip11FetchError(
				'http-error',
				`NIP-11 request failed with HTTP ${response.status}.`,
				response.status
			);
		}

		const contentType = response.headers.get('content-type')?.trim() ?? '';
		if (contentType && !isJsonContentType(contentType)) {
			throw new Nip11FetchError(
				'invalid-content-type',
				`Unsupported NIP-11 content-type: ${contentType}`
			);
		}

		const body = await readBodyWithLimit(response, maxBodyBytes);
		if (!contentType && !startsLikeJsonObject(body)) {
			throw new Nip11FetchError(
				'invalid-content-type',
				'NIP-11 response without content-type must start with a JSON object.'
			);
		}

		return parseRelayInformation(body);
	} catch (error) {
		if (error instanceof Nip11FetchError) throw error;
		if (
			controller.signal.aborted ||
			(error instanceof DOMException && error.name === 'AbortError')
		) {
			throw new Nip11FetchError('timeout', `NIP-11 request timed out after ${timeoutMs}ms.`);
		}
		throw new Nip11FetchError(
			'fetch-failed',
			error instanceof Error
				? error.message
				: 'NIP-11 request failed before a response was available.'
		);
	} finally {
		clearTimeout(timeout);
	}
};

export const serializeNip11FetchError = (error: unknown): SerializedNip11FetchError => {
	if (error instanceof Nip11FetchError) {
		return {
			code: error.code,
			message: error.message,
			...(error.status === undefined ? {} : { status: error.status })
		};
	}

	return {
		code: 'fetch-failed',
		message: error instanceof Error ? error.message : String(error)
	};
};
