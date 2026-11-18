// Bunny Edge Script (middleware) for the nostr.watch pull zone.
//
// GET/HEAD "/" or "/index.html" with an Accept header that allows text/markdown
// (q > 0) is rewritten to "/index.md", built from static/index.md. Responses for
// "/index.md" get `Content-Type: text/markdown`; HTML responses for "/" get a
// `Link` header pointing at the markdown version. Both get `Vary: Accept`.
//
// Must run in the "before cache" phase (EdgeScriptExecutionPhase = 2) so the
// rewrite changes the cache key and HTML and markdown never share a cache entry.
import * as BunnySDK from '@bunny.net/edgescript-sdk';

const MARKDOWN = 'text/markdown; charset=utf-8';
const PAGES = new Set(['/', '/index.html']);

function acceptsMarkdown(accept) {
	return (accept ?? '').split(',').some((range) => {
		const [type, ...params] = range
			.toLowerCase()
			.split(';')
			.map((part) => part.trim());
		const q = params.find((param) => param.startsWith('q='));
		return type === 'text/markdown' && (!q || Number(q.slice(2)) > 0);
	});
}

function rewriteRequest(request) {
	if (!['GET', 'HEAD'].includes(request.method) || !acceptsMarkdown(request.headers.get('accept')))
		return request;
	const url = new URL(request.url);
	if (!PAGES.has(url.pathname)) return request;
	url.pathname = '/index.md';
	return new Request(url, request);
}

function decorateResponse(request, response) {
	const path = new URL(request.url).pathname;
	const markdown = path === '/index.md';
	const html = PAGES.has(path) && response.headers.get('content-type')?.includes('text/html');
	if ((!markdown && !html) || !response.ok) return response;
	const headers = new Headers(response.headers);
	const vary = headers.get('vary');
	if (!vary?.split(',').some((value) => value.trim().toLowerCase() === 'accept')) {
		headers.set('vary', vary ? `${vary}, Accept` : 'Accept');
	}
	if (markdown) headers.set('content-type', MARKDOWN);
	else headers.append('link', '</index.md>; rel="alternate"; type="text/markdown"');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

BunnySDK.net.http
	.servePullZone()
	.onClientRequest((ctx) => Promise.resolve(rewriteRequest(ctx.request)))
	.onClientResponse((ctx) => Promise.resolve(decorateResponse(ctx.request, ctx.response)));
