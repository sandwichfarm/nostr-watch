> this project is alpha! changes are fast and hard. branching model and tests will come with beta. 

# nostr-watch 0.1.0

Production [![production: nostrwatch](https://github.com/dskvr/nostr-watch/actions/workflows/deploy.yml/badge.svg)](https://nostr.watch)

Staging [![Netlify Status](https://api.netlify.com/api/v1/badges/d99dd01e-2d30-48df-8fad-2969edaf04fa/deploy-status)](https://next.nostr.watch)

A client-side nostr network status built with Vue3, Pinia, [nostr-tools](https://github.com/fiatjaf/nostr-tools), [nostr-js](https://github.com/jb55/nostr-js) and [nostr-relay-inspector](https://github.com/dskvr/nostr-relay-inspector). 

nostr.watch aggregates various datapoints nostr relays and the network in general to assist users, developers and relay operators. 

## Features
- [x] Real-time relay status 
- [x] Real-time, client-centric latency tests 
- [x] Relay Identities
- [x] Static JSON API for **all** known relays shared via [/relays.json](https://nostr.watch/relays.json)
- [x] Detailed Relay View
- [x] Relay Behavior Analysis
- [x] NIP Checks
- [x] Geo Checks (build-time)
- [x] Favorite Relays 
- [x] Extension Support 
- [x] Nostr signing, individualized relay testing 
- [ ] Lighting Tips to Relay Operators
- [ ] Relay Statistics 
- [ ] Relay Historical Data
- [ ] Discover relays at runtime (currently buildtime, ready to move to runtime with 0.1) 
- [ ] Discover geo at runtime


## Project setup
```
yarn install
```

## Pre-build


### Compiles and hot-reloads for development
Run once or whenever you want to update geo/discover relays 
```
yarn prebuild
```
```
yarn serve
```

### Compiles and minifies for production
_This runs prebuild every time_
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
