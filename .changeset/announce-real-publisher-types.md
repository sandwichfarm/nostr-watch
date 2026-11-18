---
"@nostrwatch/announce": patch
---

Remove the stale ambient `@nostrwatch/publisher` declaration so announce compiles against the package's real types, import `PublisherFactory` from the package instead of a relative source path, and type the monitor pubkey as `string`.
