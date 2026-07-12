export const readResponseBodyWithLimit = async (
	response: Response,
	maxBodyBytes: number,
	tooLarge: () => Error
): Promise<string> => {
	const contentLength = response.headers.get('content-length');
	if (contentLength) {
		const parsedLength = Number(contentLength);
		if (Number.isFinite(parsedLength) && parsedLength > maxBodyBytes) throw tooLarge();
	}

	if (!response.body) {
		const text = await response.text();
		if (new TextEncoder().encode(text).byteLength > maxBodyBytes) throw tooLarge();
		return text;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;

		received += value.byteLength;
		if (received > maxBodyBytes) {
			await reader.cancel();
			throw tooLarge();
		}
		chunks.push(value);
	}

	const body = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder().decode(body);
};
