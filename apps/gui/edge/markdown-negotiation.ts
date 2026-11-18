// Bunny Edge Script (middleware) for the nostr.watch pull zone.
//
// Requests for "/" that send `Accept: text/markdown` get the markdown twin of
// the homepage (`/index.md`, built from `static/index.md`). Everything else
// passes through unchanged.
//
// Runs in the "before cache" phase (pull zone > General > Origin >
// "Run script before cache", or EdgeScriptExecutionPhase = 2) so the rewrite
// changes the cache key: HTML and markdown never share a cache entry.
import * as BunnySDK from '@bunny.net/edgescript-sdk@0.13.0';

const wantsMarkdown = (req: Request): boolean =>
	(req.headers.get('accept') ?? '').toLowerCase().includes('text/markdown');

BunnySDK.net.http
	.servePullZone({ url: 'https://nostr.watch' })
	.onClientRequest((ctx) => {
		const url = new URL(ctx.request.url);
		if ((url.pathname === '/' || url.pathname === '/index.html') && wantsMarkdown(ctx.request)) {
			url.pathname = '/index.md';
			return Promise.resolve(new Request(url.toString(), ctx.request));
		}
		return Promise.resolve(ctx.request);
	})
	.onClientResponse((ctx) => {
		const path = new URL(ctx.request.url).pathname;
		if (path.endsWith('.md')) {
			const headers = new Headers(ctx.response.headers);
			headers.set('Content-Type', 'text/markdown; charset=utf-8');
			headers.set('Vary', 'Accept');
			return Promise.resolve(
				new Response(ctx.response.body, { status: ctx.response.status, headers })
			);
		}
		return Promise.resolve(ctx.response);
	});
