# @nostrwatch/route66-wsadapter-nostrtools

## 0.0.6

### Patch Changes

- [#994](https://github.com/sandwichfarm/nostr-watch/pull/994) [`77c6292`](https://github.com/sandwichfarm/nostr-watch/commit/77c62927b6800fd3f8e3d3d8f61579eea51360be) Thanks [@dskvr](https://github.com/dskvr)! - Add `dedupeUrls` to `@nostrwatch/utils`. Route66 services no longer accumulate repeated relays in a relay group, and the nostr-tools websocket worker dedupes relay lists before every request, so a fetch no longer targets the same relay dozens of times.

  The GUI seed script is now best-effort: relay queries are bounded by a script deadline and a per-query watchdog, operator metadata has its own time budget, and a failure or timeout writes an empty seed and exits 0 instead of failing the build (`SEED_STRICT=true` restores a non-zero exit). `SEED_ALLOW_EMPTY` is no longer read.

- Updated dependencies [[`77c6292`](https://github.com/sandwichfarm/nostr-watch/commit/77c62927b6800fd3f8e3d3d8f61579eea51360be)]:
  - @nostrwatch/utils@0.4.2
  - @nostrwatch/route66@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [[`c67cfc4`](https://github.com/sandwichfarm/nostr-watch/commit/c67cfc4096e63f33b806219a2adb2151852acc6d)]:
  - @nostrwatch/utils@0.4.1
  - @nostrwatch/route66@0.0.5

## 0.0.4

### Patch Changes

- [#988](https://github.com/sandwichfarm/nostr-watch/pull/988) [`b732346`](https://github.com/sandwichfarm/nostr-watch/commit/b7323468201c8e2833c3f917c3a27d087bcccd19) Thanks [@dskvr](https://github.com/dskvr)! - Add `isLocalNetworkHost` and `isLocalNetworkUrl` to `@nostrwatch/utils`. The nostr-tools websocket worker now drops relay URLs that target loopback or private network addresses before connecting, publishing or closing.

- Updated dependencies [[`b732346`](https://github.com/sandwichfarm/nostr-watch/commit/b7323468201c8e2833c3f917c3a27d087bcccd19)]:
  - @nostrwatch/utils@0.4.0
  - @nostrwatch/route66@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies []:
  - @nostrwatch/route66@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @nostrwatch/route66@0.0.2
