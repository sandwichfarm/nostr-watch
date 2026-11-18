# @nostrwatch/nostrings

## 0.6.3

### Patch Changes

- [#991](https://github.com/sandwichfarm/nostr-watch/pull/991) [`a7eac01`](https://github.com/sandwichfarm/nostr-watch/commit/a7eac01d1ca6845f455d97fb320fe548f49e5e1e) Thanks [@dskvr](https://github.com/dskvr)! - `qualifyRelayUrl` now rejects relay URLs whose hostname cannot be resolved or granted network permission: empty labels (`wss://.well-known/...`, `a..b`), characters outside `[a-z0-9_-]`, labels over 63 octets and names over 253 octets. A single trailing root dot is still accepted. The rule is exported as `isValidRelayHostname`. `VERSION` is synced to the package version (0.6.2), which re-runs relaymon's nostrings sweep over existing rows.

- [#989](https://github.com/sandwichfarm/nostr-watch/pull/989) [`9afaba4`](https://github.com/sandwichfarm/nostr-watch/commit/9afaba426a804a66afabd12861115cd67175cf41) Thanks [@dskvr](https://github.com/dskvr)! - `qualifyRelayUrl` now rejects loopback, private, link-local, CGNAT and local-only hostnames with `isLocalNetworkUrl` from `@nostrwatch/utils`, replacing the regex checks that missed `169.254.0.0/16`, `0.0.0.0`, `100.64.0.0/10` and suffixes such as `.internal` and `.lan`.

- Updated dependencies [[`c67cfc4`](https://github.com/sandwichfarm/nostr-watch/commit/c67cfc4096e63f33b806219a2adb2151852acc6d)]:
  - @nostrwatch/utils@0.4.1

## 0.6.2

### Patch Changes

- [#964](https://github.com/sandwichfarm/nostr-watch/pull/964) [`8c3ec0e`](https://github.com/sandwichfarm/nostr-watch/commit/8c3ec0ec07954df72336b3bedde981392f947858) Thanks [@dskvr](https://github.com/dskvr)! - Allow npub hostnames under .fips while retaining npub rejection in paths and other URL components. This restores FIPS identity relay discovery and seeding.

## 0.4.0

### Minor Changes

- [`1cc5123`](https://github.com/sandwichfarm/nostr-watch/commit/1cc512389dc9e9657048ea41e108580cd4816399) Thanks [@dskvr](https://github.com/dskvr)! - add missing garbage URL case to @nostrwatch/nostrings

## 0.3.0

### Minor Changes

- a718902: relay urls with usernames were slipping through, migrations and fix sanitizer

## 0.2.2

### Patch Changes

- 73083b3: nocapd improvements, fixed some uncaught errors in nocap adapters, improved nostrings

## 0.2.1

### Patch Changes

- af3fb46: non-destructive sanitize/dedup with hierarchal relay detection mechanism

## 0.2.0

### Minor Changes

- 296aac0: concurrency fix for constrained environments

## 0.1.0

### Minor Changes

- 75a585e: nostrings + nocapd improvements
