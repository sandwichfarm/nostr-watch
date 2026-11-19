---
"@nostrwatch/utils": patch
"@nostrwatch/route66": patch
"@nostrwatch/route66-wsadapter-nostrtools": patch
"@nostrwatch/gui": patch
---

Add `dedupeUrls` to `@nostrwatch/utils`. Route66 services no longer accumulate repeated relays in a relay group, and the nostr-tools websocket worker dedupes relay lists before every request, so a fetch no longer targets the same relay dozens of times.

The GUI seed script is now best-effort: relay queries are bounded by a script deadline and a per-query watchdog, operator metadata has its own time budget, and a failure or timeout writes an empty seed and exits 0 instead of failing the build (`SEED_STRICT=true` restores a non-zero exit). `SEED_ALLOW_EMPTY` is no longer read.
