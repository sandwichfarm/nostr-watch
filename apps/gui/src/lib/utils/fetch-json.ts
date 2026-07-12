export type FetchJsonResourceOptions = {
	timeoutMs?: number;
	cache?: RequestCache;
	fetchImpl?: typeof fetch;
};

export const fetchJsonResource = async <T>(
	url: string,
	options: FetchJsonResourceOptions = {}
): Promise<T | null> => {
	const timeoutMs = Number.isFinite(options.timeoutMs)
		? Math.max(0, options.timeoutMs as number)
		: 15_000;
	const controller = new AbortController();
	const timeout = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

	try {
		const response = await (options.fetchImpl ?? fetch)(url, {
			redirect: 'error',
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
			cache: options.cache,
			signal: controller.signal
		});
		if (!response.ok || response.redirected) return null;
		return (await response.json()) as T;
	} catch {
		return null;
	} finally {
		if (timeout !== null) clearTimeout(timeout);
	}
};
