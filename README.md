> @nostrwatch is in heavy development. Legacy nostr.watch is **in maintenance mode**.

# @nostrwatch 
nostr.watch discovers, monitors and indexes nostr relays, and then publishes the results in the form of NIP-66. There are many shared packages between agents and clients. The ones that are useful external to nostr.watch are in `./libraries` and purpose built packages are in `./internal`. 

# Stack

## agents 
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

```
git clone https://github.com/sandwichfarm/nostr-watch.git
cd ./nostr-watch
yarn bootstrap
yarn install 
```
