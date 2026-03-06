# Glossary

Terms and concepts used throughout the NIP-66 ecosystem.

## Nostr Concepts

**Event**
: The fundamental data unit of Nostr. A JSON object with fields: `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig`. Every event is signed by its author's private key.

**Kind**
: A number identifying the type of event. NIP-66 uses kinds 10166, 30166, and 1066.

**Relay**
: A WebSocket server that stores and forwards Nostr events. Relays are the infrastructure of the Nostr network.

**Pubkey**
: A public key identifying a Nostr user or service. Displayed as a 64-character hex string or as an `npub` Bech32 address.

**REQ**
: A Nostr protocol message for requesting events from a relay. Includes filters for kinds, authors, tags, and time ranges.

**Replaceable Event**
: An event where only the latest version per pubkey is kept. Kind 10166 is replaceable.

**Parameterized Replaceable Event**
: An event where only the latest version per (pubkey, `d` tag) pair is kept. Kind 30166 is parameterized replaceable -- one event per relay per monitor.

**NIP**
: Nostr Implementation Possibility. A specification document describing a feature or convention. [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) defines relay monitoring.

## NIP-66 Concepts

**Monitor**
: A service that periodically checks Nostr relays and publishes the results as NIP-66 events. Multiple independent monitors form a monitoring network.

**Kind 10166 (Monitor Announcement)**
: A replaceable event published by a monitor to announce its existence, check types, frequency, and network coverage.

**Kind 30166 (Relay Status)**
: A parameterized replaceable event published by a monitor containing the current health, capabilities, and metadata for one relay.

**Kind 1066 (Relay Status Delta)**
: A regular event recording a state change for a relay. Used for building historical timelines.

**R Tag**
: A tag in kind 30166 events encoding relay capability flags. Values without `!` are active, values with `!` are not active.

**RTT (Round-Trip Time)**
: The time in milliseconds for a monitor to complete a check. Encoded in `rtt-open`, `rtt-read`, and `rtt-write` tags.

**Quorum**
: The minimum fraction of monitors that must report a value for it to be included in the aggregated result.

**MAD Scale**
: Median Absolute Deviation scale factor used for outlier detection in aggregation. Higher values are more permissive.

## rstate Concepts

**rstate**
: The relay state aggregation engine. Ingests NIP-66 events, computes consensus values across monitors, and serves results via CVM and REST.

**Aggregation**
: The process of combining observations from multiple monitors into a single consensus view of a relay's state.

**Response Shape / Format**
: The level of detail in API responses. `full` includes per-monitor attribution, `detailed` (default) shows aggregated values, `simple` returns URLs only.

## CVM Concepts

**CVM (ContextVM)**
: A protocol for running MCP (Model Context Protocol) over Nostr. Tool calls and responses are transported as Nostr events.

**MCP (Model Context Protocol)**
: A protocol for AI systems to call external tools. CVM uses MCP's `tools/call` method over Nostr.

**Tool**
: An MCP operation that takes structured input and returns structured output. rstate exposes 21 tools for querying relay data.

## Payment Concepts

**CEP-8**
: A format for advertising priced capabilities in CVM. Maps tool names to amounts and currencies.

**L402**
: A payment protocol using Lightning Network invoices. The client pays an invoice and presents the preimage as proof.

**Cashu**
: An ecash protocol. Tokens can be locked to a recipient's pubkey (P2PK) for payment.

**PricedCapability**
: A CEP-8 entry declaring the price for calling a specific tool: `{ method, name, amount, currencyUnit, description }`.
