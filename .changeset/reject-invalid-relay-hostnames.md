---
"@nostrwatch/nostrings": patch
---

`qualifyRelayUrl` now rejects relay URLs whose hostname cannot be resolved or granted network permission: empty labels (`wss://.well-known/...`, `a..b`), characters outside `[a-z0-9_-]`, labels over 63 octets and names over 253 octets. A single trailing root dot is still accepted. The rule is exported as `isValidRelayHostname`. `VERSION` is synced to the package version (0.6.2), which re-runs relaymon's nostrings sweep over existing rows.
