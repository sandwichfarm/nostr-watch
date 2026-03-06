# Data Pipeline

How relay monitoring data flows from checks to your application.

## Overview

```
Monitors → nocap → publisher → NIP-66 events → Nostr relays → rstate → CVM / REST
```

Each stage transforms the data:

1. **Monitors** run health checks against relays
2. **nocap** performs the actual WebSocket, DNS, SSL, and HTTP checks
3. **publisher** converts check results into signed NIP-66 events
4. **NIP-66 events** are published to Nostr relays that support them
5. **rstate** ingests events from relays and aggregates across monitors
6. **CVM / REST** serve the aggregated data to your application

## Stage 1: Monitors

Monitors are services that periodically check Nostr relays. The nostr-watch network runs monitors across six continents, each checking relays every hour.

Each monitor:
- Connects to target relays via WebSocket
- Performs configured checks (open, read, write, SSL, DNS, geo, NIP-11 info)
- Measures round-trip times
- Records which NIPs the relay supports
- Detects requirements (auth, payment, proof of work)

Monitors announce themselves by publishing kind 10166 events.

## Stage 2: Check Engine (nocap)

[nocap](https://docs.nostr.watch) is the check engine that performs the actual relay tests. It's modular -- different check types are implemented as plugins (called "adapters"):

- **open** -- can we establish a WebSocket connection?
- **read** -- does the relay respond to REQ messages?
- **write** -- does the relay accept EVENT messages?
- **ssl** -- is the TLS certificate valid?
- **dns** -- does the hostname resolve?
- **geo** -- what's the relay's geographic location?
- **info** -- what does the NIP-11 info document say?

## Stage 3: Publisher

The publisher converts nocap check results into signed NIP-66 events:

- **Kind 30166** -- one per relay, parameterized replaceable. Contains all current check data.
- **Kind 1066** -- delta events recording what changed since the last check.

Events are signed with the monitor's private key, ensuring cryptographic proof of who observed what.

## Stage 4: Nostr Relays

NIP-66 events are published to relays that store them:

- `wss://relay.nostr.watch` -- primary nostr.watch relay
- `wss://relaypag.es` -- Relaypages relay
- `wss://monitorlizard.nostr1.com` -- Monitor Lizard relay

These relays index NIP-66 events by kind, tags, and author, making them queryable via standard Nostr REQ filters.

**This is where you connect if using Raw NIP-66.** You query these relays directly, verify signatures, and aggregate the data yourself.

## Stage 5: rstate Aggregation

rstate is the aggregation engine that turns raw monitor observations into consensus data:

1. **Ingestion** -- connects to NIP-66 relays and subscribes to kind 30166 events
2. **Monitor tracking** -- identifies active monitors from kind 10166 announcements
3. **Aggregation** -- for each relay, combines observations from all monitors:
   - **Quorum** -- requires a minimum fraction of monitors to agree
   - **Outlier detection** -- uses MAD (Median Absolute Deviation) to discard outliers
   - **Weighting** -- recent observations and reliable monitors get more weight
4. **Caching** -- stores aggregated state in memory with TTL-based invalidation

## Stage 6: Serving (CVM / REST)

rstate serves aggregated data through two interfaces:

### CVM Path
- Client sends MCP `tools/call` as a Nostr event
- rstate processes the tool call
- Result returned as a Nostr event
- No IP addresses exposed

### REST Path
- Client makes HTTP requests
- Fastify handles routing and validation
- Responses shaped by `format` parameter (full/detailed/simple)
- OpenAPI docs at `/docs`

## Data Freshness

| Stage | Latency | Notes |
|-------|---------|-------|
| Monitor check | ~minutes | Depends on check type and relay response |
| Event publication | ~seconds | Time to publish to Nostr relays |
| rstate ingestion | ~seconds | Subscribed to real-time updates |
| Cache TTL | 60 seconds | Configurable per instance |

Typical end-to-end: a relay status change is visible through CVM/REST within **1-2 minutes** of the monitor observing it. Through raw NIP-66, it's visible as soon as the relay indexes the event (seconds).

## Which Stage to Tap Into

| Your Need | Connect At | Interface |
|-----------|-----------|-----------|
| Maximum freshness, trustless | Stage 4 (Nostr relays) | Raw NIP-66 |
| Structured queries, Nostr privacy | Stage 6 (CVM) | CVM tools |
| Simple HTTP, quick start | Stage 6 (REST) | REST API |
| Full pipeline control | Stage 5 (self-host rstate) | Any |
