# @nostrwatch/utils

## 0.4.1

### Patch Changes

- [#992](https://github.com/sandwichfarm/nostr-watch/pull/992) [`c67cfc4`](https://github.com/sandwichfarm/nostr-watch/commit/c67cfc4096e63f33b806219a2adb2151852acc6d) Thanks [@dskvr](https://github.com/dskvr)! - Emit `.js` extensions on relative specifiers in the published declaration files (`dist/types`). The package is `"type": "module"`, so consumers resolving types with `moduleResolution: node16`/`nodenext` could not follow `export * from './network'` and saw no named exports (e.g. `isLocalNetworkUrl`). Sources and runtime bundles are unchanged.

## 0.4.0

### Minor Changes

- [#988](https://github.com/sandwichfarm/nostr-watch/pull/988) [`b732346`](https://github.com/sandwichfarm/nostr-watch/commit/b7323468201c8e2833c3f917c3a27d087bcccd19) Thanks [@dskvr](https://github.com/dskvr)! - Add `isLocalNetworkHost` and `isLocalNetworkUrl` to `@nostrwatch/utils`. The nostr-tools websocket worker now drops relay URLs that target loopback or private network addresses before connecting, publishing or closing.

## 0.3.0

### Minor Changes

- [#961](https://github.com/sandwichfarm/nostr-watch/pull/961) [`0b9b77a`](https://github.com/sandwichfarm/nostr-watch/commit/0b9b77ad6af0a7c50030c3d9c907620f1131426a) Thanks [@dskvr](https://github.com/dskvr)! - Recognize FIPS relay hostnames and monitor them through host-provided DNS and
  IPv6 routing. Prevent non-clearnet DNS checks from leaking overlay names to
  public DNS-over-HTTPS resolvers.

## 0.2.0

### Minor Changes

- [`0e865bf`](https://github.com/sandwichfarm/nostr-watch/commit/0e865bfccd307f39e87433f1823c00e457383459) Thanks [@dskvr](https://github.com/dskvr)! - Compatiblity updates to @nostrwatch/utils

## 0.1.9

### Patch Changes

- e0d996b: concurrency, race condition and lmdb fixes

## 0.1.8

### Patch Changes

- af3fb46: non-destructive sanitize/dedup with hierarchal relay detection mechanism

## 0.1.7

### Patch Changes

- d0adc3d: trawler/nocapd refactor

## 0.1.6

### Patch Changes

- 00693ff: nocapd is faster

## 0.1.5

### Patch Changes

- 00693ff: nocapd is faster

## 0.1.4

### Patch Changes

- 14b2337: nocapd is faster
