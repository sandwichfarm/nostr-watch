import { readResponseBodyWithLimit } from '$lib/utils/response-body';

export type VerifyNip05Options = {
	fetchImpl?: typeof fetch;
	timeoutMs?: number;
	maxBodyBytes?: number;
};

const NIP05_PATTERN = /^(?:([\w.+-]+)@)?([\w_-]+(?:\.[\w_-]+)+)$/;
const NIP05_TIMEOUT_MS = 10_000;
const NIP05_MAX_BODY_BYTES = 128 * 1024;

const isJsonContentType = (contentType: string): boolean => {
	const mime = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	return mime === 'application/json' || mime === 'text/json' || mime.endsWith('+json');
};

export const verifyNip05 = async (
	pubkey: string,
	identifier: string,
	options: VerifyNip05Options = {}
): Promise<boolean> => {
	const match = identifier.match(NIP05_PATTERN);
	if (!match) return false;

	const [, name = '_', domain] = match;
	const url = new URL(`https://${domain}/.well-known/nostr.json`);
	url.searchParams.set('name', name);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? NIP05_TIMEOUT_MS);
	const maxBodyBytes = options.maxBodyBytes ?? NIP05_MAX_BODY_BYTES;

	try {
		const response = await (options.fetchImpl ?? fetch)(url, {
			method: 'GET',
			redirect: 'error',
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
			cache: 'no-store',
			headers: { Accept: 'application/json' },
			signal: controller.signal
		});
		if (!response.ok || response.redirected) return false;
		const contentType = response.headers.get('content-type')?.trim() ?? '';
		if (contentType && !isJsonContentType(contentType)) return false;

		const body = await readResponseBodyWithLimit(
			response,
			maxBodyBytes,
			() => new Error('NIP-05 response too large.')
		);
		const data = JSON.parse(body) as { names?: Record<string, unknown> };
		return data?.names?.[name] === pubkey;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
};
