> @nostrwatch is in heavy development. Legacy nostr.watch is **in maintenance mode**.

# @nostrwatch 
A Typescript stack for monitoring, auditing, describing and validating anything related to nostr relays. `@nostrwatch` is an [OpenSats](http://opensats.org) grant recipient.

# packages
| package                     | type     | description                                                                                                      | status | web | server | cli | notes                                                 |
|-----------------------------|----------|------------------------------------------------------------------------------------------------------------------|--------|-----|--------|-----|-------------------------------------------------------|
| @nostrwatch/gui             | webapp   | NIP-66 nostr client.                                                                                             | alpha  | ✓   |        |     |                                                       |
| @nostrwatch/trawler         | agent    | Scraps all of the known nostr-verse for relays, sanitizes and dedupes them.                                      | alpha  |     | ✓      |     | rewrite imminent                                      |
| @nostrwatch/nocapd          | agent    | Persistently checks relays on a regular interval with many configuration options.                                | alpha  |     | ✓      |     | rewrite imminent                                      |
| @nostrwatch/nip66           | library  | Library that manages NIP-66 aggregation control flow and provides utilities that help conform to NIP-66          | alpha  | ✓   | ✓      |     |                                                       |
| @nostrwatch/auditor         | library  | Checks relays against their advertised supported nips and runs a variety of passive validations along the way.   | alpha  | ✓   | ✓      | ✓   |                                                       |
| @nostrwatch/nocap           | library  | Extensible library for checking relay liveness via websocket and optionally fetches geodata, SSL, NIP-11 and DNS | alpha  | ✓   | ✓      |     |                                                       |
| @nostrwatch/schemata        | library  | JSON-Schemas for low-level protocol JSON, note kinds, protocol messages and NIP-11 information documents.        | alpha  | ✓   | ✓      |     |                                                       |
| @nostrwatch/schemata-js-ajv | library  | Library that wraps ajv and @nostrwatch/schemata to simplify validation of nostr json payloads.                   | alpha  | ✓   | ✓      |     |                                                       |
| @nostrwatch/websocket       | internal | Isomorphic Websocket wrapper                                                                                     | beta   | ✓   | ✓      |     |                                                       |
| @nostrwatch/utils           | internal | Variety of utilities that are shared between many packages.                                                      | beta   | ✓   | ✓      |     |                                                       |
| @nostwatch/announce         | internal | Basic library for monitor 10166 announcement.                                                                    | alpha  | ✓   | ✓      |     | rewrite imminent                                      |
| @nostrwatch/nwcache         | internal | LMDB wrapper for agent data                                                                                      | beta   |     | ✓      |     | needs attention                                       |
| @nostrwatch/publisher       | internal | Handles publishing of nostr events                                                                               | alpha  |     |        |     |                                                       |
| @nostrwatch/logger          | internal | Logger library used throughout all packages                                                                      | beta   |     | ✓      |     | will be replaced with logger from @nostrwatch/auditor |
| @nostrwatch/controlflow     | internal | Manages backoff and BullMQ queues                                                                                | beta   |     | ✓      |     | will be nuked after @nostrwatch/nocapd rewrite.       |
| @nostrwatch/seed            | internal | Manages seeding of relays from a variety of different sources.                                                   |        |     |        |     |                                                       |

# development

`@nostrwatch` will be open to contributions after the agents have been rewritten, contribution guidelines have been established and documents are in place for all apps, agents and libraries

