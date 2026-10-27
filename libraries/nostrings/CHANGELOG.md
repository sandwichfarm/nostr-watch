# @nostrwatch/nostrings

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
