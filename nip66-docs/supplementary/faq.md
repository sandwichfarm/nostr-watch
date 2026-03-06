# FAQ

## General

### What is NIP-66?

NIP-66 is a Nostr protocol extension (NIP = Nostr Implementation Possibility) that defines how monitors publish relay health, capability, and availability data. It specifies three event kinds: 10166 (monitor announcement), 30166 (relay status), and 1066 (relay status delta).

### Who runs the monitors?

nostr.watch operates monitors across multiple geographic regions. The protocol is open -- anyone can run a monitor and publish NIP-66 events.

### How often is the data updated?

Monitors typically check relays every hour (3600 seconds). Each monitor declares its frequency in its kind 10166 announcement. Through rstate (CVM/REST), data is ingested in real-time as monitors publish -- typical end-to-end latency is 1-2 minutes.

### Is the data free to use?

Yes. Raw NIP-66 events on Nostr relays are free to query. The nostr.watch CVM and REST API are free for standard use. Operators can optionally enable micro-payments for specific premium queries, but this is not the default.

## Trust & Privacy

### Do I need to trust nostr.watch?

It depends on your interface:

- **Raw NIP-66**: No trust required. You verify monitor signatures yourself and aggregate the data.
- **CVM**: You trust the rstate instance you connect to, but you can self-host for full sovereignty.
- **REST**: You trust the API operator. Self-hosting eliminates this trust.

### How is privacy handled?

- **Raw NIP-66**: Your only fingerprint is a WebSocket connection to a Nostr relay -- same as any Nostr client.
- **CVM**: Communication uses Nostr pubkeys over Nostr relays. No IP address exposed to the rstate server. Optional encryption.
- **REST**: Standard HTTP -- the server sees your IP address. Use a VPN or Tor if privacy is important.

### Can monitors lie about their observations?

Monitors sign their events with their private key, so you can cryptographically verify who made an observation. However, a monitor could publish false data. This is why rstate aggregates across multiple independent monitors and uses quorum requirements and outlier detection to filter anomalies.

### What if a monitor goes down?

The monitoring network is decentralized. If one monitor stops publishing, the remaining monitors continue providing data. rstate's aggregation handles variable numbers of monitors gracefully.

## Technical

### Which relays carry NIP-66 events?

```
wss://relay.nostr.watch
wss://relaypag.es
wss://monitorlizard.nostr1.com
```

### What's the difference between `full`, `detailed`, and `simple` response formats?

- **`full`**: All fields including per-monitor attribution data (which monitor reported what)
- **`detailed`** (default): Aggregated consensus values without attribution
- **`simple`**: Just relay URLs -- a string array

### Can I get real-time updates?

- **Raw NIP-66**: Yes, use Nostr subscriptions (keep a REQ open).
- **CVM**: Yes, use `relays/subscribe_state` for state change notifications.
- **REST**: SSE/subscriptions are planned but not yet available in production.

### What does "quorum" mean in aggregation?

Quorum is the minimum fraction of active monitors that must report a value for it to be included in the aggregated result. Default is 0.5 (50%). This prevents a single rogue monitor from influencing the consensus.

### How does outlier detection work?

rstate uses MAD (Median Absolute Deviation) to detect outlier observations. If a monitor reports a value far from the median, it's excluded from the aggregation. The sensitivity is controlled by the `madScale` configuration parameter.

### Can I run my own rstate instance?

Yes. See [Self-Hosting](/cvm/self-hosting). Your instance ingests raw NIP-66 events from Nostr relays, so you verify everything yourself.

## Integration

### Which interface should I use for my Nostr client?

If your client already uses a Nostr library (nostr-tools, NDK, etc.), start with CVM -- it fits naturally into the Nostr protocol flow. If you need trustless verification of specific data points, supplement with raw NIP-66 queries.

### Can I use multiple interfaces together?

Absolutely. A common pattern:
- Use REST for your dashboard's overview data
- Use CVM for AI-powered relay recommendations
- Use raw NIP-66 to verify specific claims

### How do I handle rate limiting?

Read the `Retry-After` header on 429 responses and wait that many seconds before retrying. Cache responses locally -- NIP-66 data updates hourly, so there's rarely a reason to poll more frequently than every few minutes.

### Is there an SDK or client library?

The CVM tools work with any MCP-compatible client. For REST, use standard HTTP libraries in any language. For raw NIP-66, use any Nostr library (nostr-tools for JavaScript, python-nostr for Python, etc.).
