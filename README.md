> @nostrwatch is in heavy development, everything below is presently early alpha. Legacy nostrwatch is only in maintenance mode and will only be edited to keep the site running smooth-ish until it can be fully replaced. 

# @nostrwatch 
nostr.watch discovers, monitors and indexes nostr relays, and then publishes NIP-66 events to nostr.relays. The stack a number of packages to make it work, some universally useful, and some not. 

**nostrwatch is an [OpenSats](https://opensats.org) grant recipient**

# Status 
Presently reworking many parts of the stack to make it easier to maintain, contribute towards and use. 

- Trying to DRY everything up as much as possible. 
- Refactor the daemons, eliminate ugly patterns from a bad decision and use NDK for event construction/publishing. 
- As fast as `nwcache` is, it's a total pain, the cache is going to be simplified so it works as a `kit` adapter.

# Stack

## daemons 
- **trawler** - finds new relays to monitor
- **nocapd** - monitors relays and publishes NIP-66 events

## gui
- **nostr.watch** - early stages

## libraries 
- **nocap** - Runs basic checks on relays.
- **kit** - Attempts to simplify the process of aggregating NIP-66 events (overkill for general use!)
- **idb** - Purpose built IDB for more advanced NIP-66 usage (overkill for general use!)


### Development 
a `CONTRIBUTE.md` will exist somewhere down the road. Since it's early stage, many details are not yet established, but here some details that are:

1. Primary branch for development @nostrwatch:next is `next`. Legacy is on `main` and the workflows are still functional for patches and legacy maintenance headaches. 
2. Branching model: TBD (Trunk Based Development), trunk branch is `next` for early stage. Early alpha there will be long-standing branches for packages that are not yet in next. Once `@nostrwatch:next` reaches beta `next` will become `main` and there will be `trunk` branch.
3. GH Actions will be used for CI/CD
4. Issues will be reserved for actionable items, such as bugs. Anything requiring discussion lives in discussion until it's promoted to an issue. 
5. PRs should be opened as a draft. When the PR is ready to be published commits should be squashed. 

## Development
> It is not recommended to use any of these packages for any reason at this time, except maybe out of curiousity or masochistic desire.

```
git clone https://github.com/sandwichfarm/nostr-watch.git
cd ./nostr-watch
yarn bootstrap
```

## Testing
Testing suite is not yet implemented. 

