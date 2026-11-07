---
"@nostrwatch/nostrawl": patch
---

Count cached legacy markers without decoding and retaining every event payload.
This prevents large persistent caches from exhausting the JavaScript heap before
a relay crawl begins, while preserving existing counts and all stored records.
