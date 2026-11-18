---
"@nostrwatch/nostrings": patch
---

`qualifyRelayUrl` now rejects loopback, private, link-local, CGNAT and local-only hostnames with `isLocalNetworkUrl` from `@nostrwatch/utils`, replacing the regex checks that missed `169.254.0.0/16`, `0.0.0.0`, `100.64.0.0/10` and suffixes such as `.internal` and `.lan`.
