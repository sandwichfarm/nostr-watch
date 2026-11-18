# Edge scripts

## `markdown-negotiation.ts`

Bunny Edge Script (middleware) for the nostr.watch pull zone.

- Rewrites `GET /` (and `/index.html`) to `/index.md` when the request sends `Accept: text/markdown`.
- Sets `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept` on `.md` responses.

Setup:

1. Create a middleware Edge Script from `markdown-negotiation.ts` and link it to the nostr.watch pull zone.
2. Enable **General > Origin > Run script before cache** on the pull zone (API: `EdgeScriptExecutionPhase: 2`), so the rewrite happens before the cache lookup.

Check:

```bash
curl -sI -H 'Accept: text/markdown' https://nostr.watch/ | grep -i content-type   # text/markdown
curl -sI https://nostr.watch/ | grep -i content-type                              # text/html
```
