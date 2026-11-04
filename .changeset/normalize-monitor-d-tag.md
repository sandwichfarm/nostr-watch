---
"@nostrwatch/gui": patch
---

Normalise the `d` tag of kind 30166 events before counting a monitor's online, offline and dead relays, so URL variants (trailing slash, case, default port) of one relay are no longer counted separately.
