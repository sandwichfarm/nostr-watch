# @nostrwatch/nocapd

## 1.14.0

### Minor Changes

- 3711c6e: fixed hanging job

### Patch Changes

- Updated dependencies [3711c6e]
  - @nostrwatch/nocap-every-adapter-default@1.7.0
  - @nostrwatch/nocap@0.9.2

## 1.13.0

### Minor Changes

- a718902: relay urls with usernames were slipping through, migrations and fix sanitizer

### Patch Changes

- Updated dependencies [a718902]
  - @nostrwatch/nwcache@0.5.0

## 1.12.2

### Patch Changes

- e0d996b: concurrency, race condition and lmdb fixes
- Updated dependencies [e0d996b]
  - @nostrwatch/announce@0.4.5
  - @nostrwatch/publisher@0.12.2
  - @nostrwatch/seed@0.1.3
  - @nostrwatch/utils@0.1.9

## 1.12.1

### Patch Changes

- f7101a0: hotfix hanging jobs + publisher issues
- Updated dependencies [f7101a0]
  - @nostrwatch/publisher@0.12.1
  - @nostrwatch/announce@0.4.4

## 1.12.0

### Minor Changes

- 73083b3: nocapd improvements, fixed some uncaught errors in nocap adapters, improved nostrings

### Patch Changes

- Updated dependencies [73083b3]
  - @nostrwatch/nwcache@0.4.0
  - @nostrwatch/nocap-every-adapter-default@1.6.3
  - @nostrwatch/seed@0.1.2
  - @nostrwatch/nocap@0.9.1

## 1.11.0

### Minor Changes

- 8ca31d7: improve websocket handling, improve event handling, eliminate another ws attack vectro

### Patch Changes

- Updated dependencies [8ca31d7]
  - @nostrwatch/publisher@0.12.0
  - @nostrwatch/nocap@0.9.0
  - @nostrwatch/announce@0.4.3
  - @nostrwatch/nocap-every-adapter-default@1.6.2

## 1.10.3

### Patch Changes

- 16f6f3a: hotfix: cache corruption from bytearray in ssl

## 1.10.2

### Patch Changes

- 31b9fb1: hotfix: round performance timings
- Updated dependencies [31b9fb1]
  - @nostrwatch/publisher@0.11.2

## 1.10.1

### Patch Changes

- 737cec0: hotfix: incorrect import
- Updated dependencies [737cec0]
  - @nostrwatch/publisher@0.11.1

## 1.10.0

### Minor Changes

- af3fb46: non-destructive sanitize/dedup with hierarchal relay detection mechanism

### Patch Changes

- Updated dependencies [af3fb46]
  - @nostrwatch/nwcache@0.3.0
  - @nostrwatch/publisher@0.11.0
  - @nostrwatch/nocap@0.8.0
  - @nostrwatch/announce@0.4.2
  - @nostrwatch/utils@0.1.8

## 1.9.1

### Patch Changes

- de9c900: clean out the queue a bit

## 1.9.0

### Minor Changes

- 296aac0: concurrency fix for constrained environments

## 1.8.0

### Minor Changes

- 75a585e: nostrings + nocapd improvements

### Patch Changes

- Updated dependencies [75a585e]
  - @nostrwatch/nocap-every-adapter-default@1.6.1
  - @nostrwatch/nocap@0.7.1
  - @nostrwatch/seed@0.1.1

## 1.7.0

### Minor Changes

- d0adc3d: trawler/nocapd refactor

### Patch Changes

- Updated dependencies [d0adc3d]
  - @nostrwatch/nocap-every-adapter-default@1.6.0
  - @nostrwatch/publisher@0.10.0
  - @nostrwatch/nwcache@0.2.0
  - @nostrwatch/nocap@0.7.0
  - @nostrwatch/seed@0.1.0
  - @nostrwatch/utils@0.1.7

## 1.6.1

### Patch Changes

- 38f1e69: hotfix: reverse accidental regression
- Updated dependencies [38f1e69]
  - @nostrwatch/publisher@0.9.1

## 1.6.0

### Minor Changes

- 462a82e: support multiple geohashes for geo dns confs

### Patch Changes

- Updated dependencies [462a82e]
  - @nostrwatch/nocap-every-adapter-default@1.5.0
  - @nostrwatch/publisher@0.9.0
  - @nostrwatch/nocap@0.6.0

## 1.5.1

### Patch Changes

- 32d8b25: tinkering with changesets.
- Updated dependencies [32d8b25]
  - @nostrwatch/nocap-every-adapter-default@1.4.6
  - @nostrwatch/controlflow@0.5.1
  - @nostrwatch/publisher@0.8.1
  - @nostrwatch/announce@0.4.1
  - @nostrwatch/nocap@0.5.7

## 1.5.0

### Minor Changes

- 00693ff: nocapd is faster

### Patch Changes

- Updated dependencies [00693ff]
  - @nostrwatch/controlflow@0.5.0
  - @nostrwatch/publisher@0.8.0
  - @nostrwatch/announce@0.4.0
  - @nostrwatch/nocap-every-adapter-default@1.4.5
  - @nostrwatch/nwcache@0.1.5
  - @nostrwatch/logger@0.0.9
  - @nostrwatch/nocap@0.5.6
  - @nostrwatch/utils@0.1.6
  - @nostrwatch/seed@0.0.5

## 1.4.0

### Minor Changes

- 00693ff: nocapd is faster

### Patch Changes

- Updated dependencies [00693ff]
  - @nostrwatch/controlflow@0.4.0
  - @nostrwatch/publisher@0.7.0
  - @nostrwatch/announce@0.3.0
  - @nostrwatch/nocap-every-adapter-default@1.4.4
  - @nostrwatch/nwcache@0.1.4
  - @nostrwatch/logger@0.0.8
  - @nostrwatch/nocap@0.5.5
  - @nostrwatch/utils@0.1.5
  - @nostrwatch/seed@0.0.4

## 1.3.0

### Minor Changes

- 14b2337: nocapd is faster

### Patch Changes

- Updated dependencies [14b2337]
  - @nostrwatch/controlflow@0.3.0
  - @nostrwatch/publisher@0.6.0
  - @nostrwatch/announce@0.2.0
  - @nostrwatch/nocap-every-adapter-default@1.4.3
  - @nostrwatch/nwcache@0.1.3
  - @nostrwatch/logger@0.0.7
  - @nostrwatch/nocap@0.5.4
  - @nostrwatch/utils@0.1.4
  - @nostrwatch/seed@0.0.3
