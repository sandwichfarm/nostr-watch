# nostr-watch

A client-side nostr network status built with Vue3, [nostr-js](https://github.com/jb55/nostr-js) and [nostr-relay-inspector](https://github.com/dskvr/nostr-relay-inspector). Goal is to produce a client-side app that collects detailed information about nostr relays and the network in general to assist users, developers and relay operators alike.

## Goals 
- [x] Rapidly learn Nostr Protocol _Personal Goal_
- [ ] Tool that can assist in a visual understanding of Nostr for developers 
- [ ] Tool that can assist in onboarding for Users

## Features
- [x] Real-time relay status 
- [x] Real-time, client-centric latency tests 
- [x] Relay Identities
- [x] Static JSON API for **all** known relays shared via [/relays.json](https://nostr.watch/relays.json)
- [x] Detailed Relay View
- [x] Relay Behavior Analysis
- [x] NIP Checks
- [x] Geo Checks (build-time)
- [ ] Optional Companion Backend for historical data and relay relief, front-end gracefully degrades if inaccessible. 
- [ ] "Best Relays for a User" and "Best Relays for a Developer" dynamic aggregate, the former based largely on a balance of Latency and NIP support, the latter based largely on NIP support. Unique results for each visitor

## Todo [Road to Beta] 
- [ ] Expose all features in frontend 
- [ ] Clean codebase 
- [ ] Tests

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```

### Compiles and minifies for production
```
yarn build
```

### Lints and fixes files
```
yarn lint
```

### Build Docker
```
yarn docker:build
```

## About
Originally a fork of [fiatjaf/nostr-relay-registry](http://github.com/fiatjaf/nostr-relay-registry), but completely rewritten and connection functionality was ported to [jb55/nostr-js](http://github.com/jb55/nostr-js).
