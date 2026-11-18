# Edge scripts

## `markdown-negotiation.mjs`

Bunny Edge Script (middleware) attached to the `nostr-watch` pull zone (3313140).

- `GET`/`HEAD` `/` or `/index.html` with an `Accept` header that allows `text/markdown` (q > 0) is rewritten to `/index.md`. That file is built from `static/index.md`.
- Responses for `/index.md` get `Content-Type: text/markdown; charset=utf-8`.
- HTML responses for `/` get `Link: </index.md>; rel="alternate"; type="text/markdown"`.
- Both get `Vary: Accept`. Other paths and non-2xx responses pass through unchanged.

The pull zone must run the script before the cache (`EdgeScriptExecutionPhase: 2`). That way the rewrite changes the cache key, and HTML and markdown never share a cache entry.

Deploy a new version:

```bash
bunny scripts deploy apps/gui/edge/markdown-negotiation.mjs <script-id>
```

Attach to the pull zone (one-time):

```bash
bunny api POST /pullzone/3313140 --body '{"MiddlewareScriptId": <script-id>, "EdgeScriptExecutionPhase": 2}'
```

Check:

```bash
curl -sI -H 'Accept: text/markdown' https://nostr.watch/ | grep -i content-type   # text/markdown
curl -sI https://nostr.watch/ | grep -iE 'content-type|link'                       # text/html + Link
```
