> ATTENTION! This repo is under heavy development and does not work yet. There are a number of upstream dependencies that are not yet published.

# @nostrwatch/ndk 

An NDK extension that adds advanced support to fetch complete [NIP-66]() datasets

[![semver](https://img.shields.io/npm/v/nostrwatch-ndk)](https://github.com/sandwichfarm/nostrwatch-ndk/releases/latest) 
[![cov](https://sandwichfarm.github.io/nostrwatch-ndk/badges/coverage.svg)](https://github.com/sandwichfarm/nostrwatch-ndk/actions)
[![test](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/buildtest.yaml/badge.svg)](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/buildtest.yaml) 
[![publish](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/publish.yaml/badge.svg)](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/publish.yaml) 
[![docs](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/docs.yaml/badge.svg)](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/docs.yaml) 
[![covgen](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/coverage.yaml/badge.svg)](https://github.com/sandwichfarm/nostrwatch-ndk/actions/workflows/coverage.yaml) 
![npm bundle size](https://img.shields.io/bundlephobia/minzip/nostrwatch-ndk)
![npm bundle size](https://img.shields.io/bundlephobia/min/nostrwatch-ndk)

## TODO 
- [ ] NIP-66 NDK PR 
- [x] Extend upstream NDKEvents 
- [x] Implement Fetchers 
- [x] Implement Helpers 

## Install 

```
npm install @nostrwatch/ndk
pnpm install @nostrwatch/ndk 
yarn add @nostrwatch/ndk
```

## Usage 
```typescript 
import { FetchRelayMonitors, FetchRelays } from "@nostrwatch/ndk";
..
```

## Testing 
```
npm run test
pnpm run test
yarn test
```

## Build Docs 
```
npx typedoc src/index.ts --out docs --ignoreCompilerErrors
```

Serve them with
```
npm run serve-docs
pnpm run serve-docs
yarn serve-docs
```

## Links
- [Reference Docs](https://nostrwatch-ndk.github.io)
- Guides [WIP]