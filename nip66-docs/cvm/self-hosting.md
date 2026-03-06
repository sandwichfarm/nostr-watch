# Self-Hosting CVM

Run your own rstate instance to get full sovereignty over relay intelligence data. When self-hosting, you ingest raw NIP-66 events from Nostr relays and aggregate them locally -- no trust in nostr.watch required.

## Prerequisites

- Node.js >= 20
- A Nostr private key (nsec) for the CVM server identity

## Quick Start

```bash
# Clone the repository
git clone https://github.com/sandwichfarm/nostr-watch.git
cd nostr-watch

# Install dependencies
pnpm install

# Navigate to rstate
cd apps/rstate

# Copy and edit configuration
cp config.sample.yaml config.yaml
```

Edit `config.yaml` with your settings:

```yaml
logLevel: info

cvm:
  enabled: true
  relays:
    - 'wss://relay.damus.io'
    - 'wss://relay.nostr.band'
  encryptionMode: OPTIONAL
  allowedPubkeys: []  # empty = allow all clients
  auth:
    enabled: true
    allowAny: false

ingestRelays:
  - 'wss://history.nostr.watch'

rest:
  enabled: false  # enable if you also want REST API

aggregation:
  quorum: 0.5       # minimum fraction of monitors that must agree
  labelQuorum: 0.3   # quorum for label consensus
  madScale: 3.0       # outlier detection sensitivity

cache:
  maxSize: 10000
  ttlSeconds: 60
```

Build and start:

```bash
npm run build
npm start
```

## Environment Variables

Environment variables override YAML config values. Useful for secrets and container deployments.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CVM_RELAYS` | Yes | Comma-separated relay URLs for CVM transport | `wss://relay.damus.io` |
| `INGEST_RELAYS` | Yes | Relay URLs for NIP-66 event ingestion | `wss://history.nostr.watch` |
| `CVM_SERVER_NSEC` | Yes | Server private key for signing | `nsec1...` |
| `REST_ENABLED` | No | Enable REST API alongside CVM | `true` |
| `REST_PORT` | No | REST API port | `3000` |
| `LOG_LEVEL` | No | Logging verbosity | `info` |
| `CONFIG_FILE` | No | Path to config file | `./config.yaml` |

## Configuration Reference

### CVM Section

```yaml
cvm:
  enabled: true
  relays:                # Relays for MCP tool transport
    - 'wss://relay.damus.io'
  encryptionMode: OPTIONAL  # OPTIONAL, REQUIRED, or NONE
  allowedPubkeys: []     # Restrict access to specific pubkeys (empty = allow all)
  auth:
    enabled: true
    allowAny: false      # If true, any authenticated pubkey can call tools
```

### Ingestion Section

```yaml
ingestRelays:            # Where to fetch NIP-66 events from
  - 'wss://history.nostr.watch'
  - 'wss://relay.nostr.watch'
```

### Aggregation Section

```yaml
aggregation:
  quorum: 0.5           # Fraction of monitors that must report a value
  labelQuorum: 0.3      # Lower quorum for label data (fewer monitors report labels)
  madScale: 3.0         # MAD-based outlier detection scale factor
```

### Cache Section

```yaml
cache:
  maxSize: 10000        # Maximum cached entries
  ttlSeconds: 60        # Cache TTL
```

### Optional: Publishing

rstate can also publish its own aggregated data back to Nostr:

```yaml
publishing:
  enabled: false
  relays:
    - 'wss://relay.nostr.watch'
  kind1066:
    enabled: true
    schedule: hourly
  kind20066:
    enabled: true
  kind1166:
    enabled: true
    schedule: hourly
```

## Docker

A Docker deployment is also available. Check the `apps/rstate` directory in the repository for Docker configuration.

## Verifying Your Instance

Once running, check health via the `health/ping` tool or (if REST is enabled) `GET /health/ping`:

```bash
curl http://localhost:3000/health/ping | jq '.'
```

You should see:
- `status: "ok"` -- all connections healthy
- `relayCount.ingestion > 0` -- connected to ingestion relays
- `observationCount > 0` -- NIP-66 events have been ingested

## Security Considerations

- **Keep your nsec private.** The `CVM_SERVER_NSEC` is the server's identity key. Compromise means someone can impersonate your instance.
- **Use `allowedPubkeys`** to restrict who can call CVM tools if running a private instance.
- **Enable `encryptionMode: REQUIRED`** for encrypted transport if handling sensitive queries.
- **Run behind a firewall** if the REST API is enabled. Rate limiting is configured in the `rest.rateLimit` section.
