> @nostrwatch is in heavy development, everything below is presently early alpha. Legacy nostrwatch is only in maintenance mode and will only be edited to keep the site running smooth-ish until it can be fully replaced. 

# @nostrwatch 
A monorepo with packages consisting of modules and daemons for tracking various relay datapoints. All packages are loosely coupled enabling independent, full-stack or hybrid implementations

**nostrwatch is an OpenSats grant recipient**

## Packages

```
alpha legend
------------
+ = stable
$ = heavy development
@ = light development
% = very early stage
~ = experimentation stage, prototyping
^ = porting from legacy, pushed when buggy but bootable
? = not started, research phase
! = refactoring
```

### Apps 
- [**`gui-web`**](packages/gui-web) `[?]`: Web app for monitoring relays. Has two modes, first one leverages data propagated by daemons to history relay(s) to seed the local dataset and `nocap` for client-side processing. Consumes existing packages by using an `lmdb` adapter for `IndexedDb` in the browser. Will be rewritten from the ground up.
- [**`status`**](packages/status) `[?]`: Status daemon for monitors; watches for their output and detects downtime. 
- _`...TBA`_

### Modules 
- [**`nocap`**](packages/nocap) `[$]`: Successor to `nostrwatch-js`, an extensible module for tracking various datapoints on relays.
- [**`publisher`**](packages/publisher) `[$]`: A module and daemonn that standardizes @nostrwatch events for data propagation via relays.
- _`...TBA`_


### Utilities
- [**`utils`**](packages/utils) `[%]`: General utilities and shared stateless functionality. 
- [**`logger`**](packages/logger) `[+]`: A wrapper for `logging` implemented by deamons.

### Daemons 
- [**`trawler`**](packages/trawler) `[$]`: A daemon with the single purpose of collating, sanitizing and basic classification of relays. Daemon can leverage `rest-api`.
- [**`nocapd`**](packages/nocapd) `[$]`: A daemon that persistently monitors relays and produces a rich dataset. Daemon can leverage `rest-api`.
- `...TBA`

### Cache 
- [**`nwcache`**](packages/relaydb) `[@]`: An interface for `lmdb` which is used as a processing cache. 

### Templates 
- [**`history-relay`**](packages/history-relay) `[?]`: A few configs for the new nostr.watch history relay. History relays store events for the nostr.watch datalayer.
- [**`redis`**](packages/redis) `[%]`: Convenience configuration that standardizes redis configuration for stack. Primarily used for development and eventually deployments. Redis is used for BullMQ

### Derivatives 
- [**`nostrawl`**](https://github.com/sandwichfarm/nostrawl) `[@]`: A package for trawling any number of nostr relays. Generalized logic from `trawler`. Combines `nostr-fetch` and queues, to make coalescing data from specific filters simple.
- [**`nostr-geotags`**](https://github.com/sandwichfarm/nostr-geotags/tree/main) `[+]`: A package for generating event geo `g` tags for events, needed for `NIP-66`.

### Philosophy
nostr.watch legacy has been using nostr as a data layer successfully since February 2023, less some ... _ehem_ ... hiccups. When it comes to the gui, it's a poor user experience that resulted from technical debt, scope creep and inopportune but uniquely opportune timing. It has never had any database. It has run entirely off data from nostr. Relays are the database. 

`@nostrwatch:next` will continue to employ the philosophy of nostr as a source of truth. However, this time `lmdb` will be used for local cache for performance and to produce richer datasets. Each daemon has it's own database, but daemons in a shared environment can (or can not) share the same database.

### Contribution
Contribution during this stage would be difficult but I'm open to it. If you want to contribute in any way, the best place to start is to open a [discussion](https://github.com/sandwichfarm/nostr-watch/discussions) and review the nostrwatch [project tracker](https://github.com/orgs/sandwichfarm/projects/3). Projects will grow as I migrate relevant items from planning that are presently in Notion to Github (~December). 

1. I often rapidly prototype in javascript, but modules will be ported to Typescript by the respective package's beta. 
2. Daemons with little need for type safety are likely to stay vanilla javascript unless it becomes a priority or someone takes initiative. 
3. Discuss -> Propose -> Execute

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

