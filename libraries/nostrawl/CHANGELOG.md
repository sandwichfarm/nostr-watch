# nostrawl

## 0.2.2

### Patch Changes

- [#974](https://github.com/sandwichfarm/nostr-watch/pull/974) [`11d8eb9`](https://github.com/sandwichfarm/nostr-watch/commit/11d8eb94644679712746efd09e9a4eb1b88c116b) Thanks [@dskvr](https://github.com/dskvr)! - Count cached legacy markers without decoding and retaining every event payload.
  This prevents large persistent caches from exhausting the JavaScript heap before
  a relay crawl begins, while preserving existing counts and all stored records.

## 0.2.1

### Patch Changes

- [#968](https://github.com/sandwichfarm/nostr-watch/pull/968) [`fec1280`](https://github.com/sandwichfarm/nostr-watch/commit/fec1280e701f047e5e244a014426580b2f7763ba) Thanks [@dskvr](https://github.com/dskvr)! - Keep progress reporting and counters intact when a peer timestamp cannot be formatted as a date.

## 0.2.0

### Minor Changes

- [#865](https://github.com/sandwichfarm/nostr-watch/pull/865) [`2420597`](https://github.com/sandwichfarm/nostr-watch/commit/24205972e4987159baba4c2df8bbcf9330d2d21d) Thanks [@dskvr](https://github.com/dskvr)! - Replace nostr-fetch with applesauce-relay and add NIP-77 negentropy sync support
