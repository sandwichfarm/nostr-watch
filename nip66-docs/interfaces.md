# Choosing an Interface

NIP-66 relay monitoring data is available through three interfaces. Each has different tradeoffs around cost, privacy, complexity, and trust.

## Comparison

| | Raw NIP-66 | CVM (MCP over Nostr) | REST API |
|---|---|---|---|
| **Cost** | Free | Mostly free (some tools may have micro-payments) | Free tier available |
| **Privacy** | Best -- direct relay connection, no intermediary | Good -- uses Nostr pubkeys, not IP addresses | Lowest -- IP-based, standard HTTP |
| **Complexity** | Highest -- parse events, verify signatures, aggregate | Moderate -- structured tool calls over Nostr | Easiest -- standard HTTP requests |
| **Bandwidth** | You control it -- subscribe to exactly what you need | Moderate -- request/response per tool call | Low per request, but no streaming yet |
| **Trust Model** | Trustless -- verify monitor signatures yourself | Self-hostable -- run your own rstate instance | Requires trust in the API operator |
| **Best For** | Nostr-native apps, privacy-sensitive use cases | Nostr clients wanting structured data, AI agents | Quick prototyping, non-Nostr apps, dashboards |

## Decision Guide

**Start with Raw NIP-66 if:**
- Your app already speaks Nostr (uses nostr-tools, NDK, etc.)
- You need maximum privacy and decentralization
- You want to verify data provenance through cryptographic signatures
- You're building a relay selection algorithm that needs raw observation data

**Start with CVM if:**
- You're building a Nostr client and want structured relay intelligence
- You're using Claude Desktop or another MCP-compatible AI tool
- You want the privacy benefits of Nostr but don't want to parse raw events
- You might want to self-host for full sovereignty

**Start with REST if:**
- You're prototyping and want the fastest path to working code
- Your app isn't Nostr-native (web dashboard, monitoring tool, etc.)
- You need aggregated data without building your own aggregation pipeline
- You're comfortable trusting the API operator (or plan to self-host later)

## Can I Switch Later?

Yes. All three interfaces expose the same underlying data. The raw NIP-66 events are the source of truth -- CVM and REST are both derived from them via the [rstate aggregation engine](/supplementary/data-pipeline).

A common progression:
1. **Prototype** with REST for speed
2. **Migrate** to CVM for better privacy and Nostr integration
3. **Add** raw NIP-66 queries for specific use cases that need trustless verification

## Response Formats

Both CVM and REST support three response formats:

| Format | Description | Use When |
|--------|-------------|----------|
| `full` | All fields including per-monitor attribution data | You need to see which monitors reported what |
| `detailed` | Aggregated values without attribution (default) | Most use cases -- clean, structured data |
| `simple` | Relay URLs only | You just need a list of relay addresses |

Pass `format=full`, `format=detailed`, or `format=simple` as a parameter.
