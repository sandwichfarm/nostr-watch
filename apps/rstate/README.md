# @nostrwatch/rstate

State machine that derives a subjective truth from an inclusive aggregate of NIP-66 data.

## Overview

Aggregates relay monitoring data from multiple independent NIP-66 monitors, resolves conflicts using configurable policies, and exposes a rich query interface via two complementary interfaces:

- **MCP over Nostr (ContextVM)**: JSON-RPC over Nostr for AI agents and MCP clients
- **REST API**: HTTP REST with Swagger docs for web/mobile apps

## Features

### Core Capabilities
- **NIP-66 Ingestion**: Subscribes to kinds 10166 (monitor announcements) and 30166 (relay observations)
- **Conflict Resolution**: Deterministic aggregation using median, majority voting, and support ratios
- **Rich Queries**: Search by network, NIPs, software, labels (ASN, ISP, country), latency, and more
- **Geospatial**: Radius, bounding box, and nearest-N queries using geohash tags
- **NIP-32 Labels**: Extensible metadata support for ASNs, ISPs, IPs, countries, versions, etc.
- **Monitor Scoring**: Reliability and coverage analytics for data quality assessment

### Dual Interface
- **MCP over Nostr** (21 tools): For AI agents, Claude Desktop, MCP clients
- **REST API**: OpenAPI/Swagger docs at `/docs` when enabled
- **Real-time Subscriptions**: SSE (Server-Sent Events) for push notifications
- **Full Parity**: Both interfaces expose identical functionality

### Performance & Security
- **Intelligent Caching**: TTL-based query cache with LRU eviction
- **Rate Limiting**: Token bucket with per-route costs
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Input Validation**: Comprehensive sanitization and validation
- **Graceful Shutdown**: Clean teardown on SIGTERM/SIGINT

## Quick Start

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure required variables:

```bash
# Required
CVM_RELAYS=wss://relay.damus.io,wss://relay.nostr.band
INGEST_RELAYS=wss://history.nostr.watch,wss://relay.nostr.watch
CVM_SERVER_NSEC=nsec1...

# Optional - Enable REST API
REST_ENABLED=true
REST_PORT=3000
REST_ENABLE_SWAGGER=true
```

See [Configuration Reference](#configuration-reference) for all options.

### Development

```bash
# Build
npm run build

# Development mode (watch)
npm run dev

# Run tests
npm test
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

## REST API

When `REST_ENABLED=true`, the server exposes an HTTP REST API alongside MCP.

### Features

- **OpenAPI Documentation**: Available at `http://localhost:3000/docs`
- **CORS Support**: Configurable origins for cross-origin requests
- **Rate Limiting**: Per-IP token bucket with route-based costs
- **Caching**: ETag/Cache-Control with 304 Not Modified support
- **Real-time**: Server-Sent Events (SSE) for subscriptions
- **Security**: HSTS, CSP, input validation, sanitized errors

### Endpoints

#### Health
- `GET /health/ping` - Server health with cache stats

#### Relays
- `GET /relays` - List relays with pagination/sorting
- `GET /relays/state?relayUrl=<url>` - Get specific relay state
- `POST /relays/search` - Filter relays by criteria
- `GET /relays/nearby?lat=<lat>&lon=<lon>&radius=<km>` - Find relays near coordinates
- `GET /relays/bbox?sw.lat=<lat>&sw.lon=<lon>&ne.lat=<lat>&ne.lon=<lon>` - Find relays in bounding box
- `GET /relays/labels?relayUrl=<url>` - Get relay labels
- `GET /relays/labels/list` - List all available labels
- `GET /relays/by/label?namespace=<ns>&value=<val>` - Find relays with label
- `GET /relays/by/software` - Group by software
- `GET /relays/by/network` - Group by network type
- `GET /relays/by/nip` - Group by NIP support
- `GET /relays/by/country` - Group by country
- `POST /relays/compare` - Compare multiple relays (requires payment)
- `POST /relays/online` - Find online relays
- `POST /relays/offline` - Find offline relays
- `POST /relays/dead` - Find dead relays

#### Monitors
- `GET /monitors` - List monitors
- `GET /monitors/:pubkey` - Get monitor info
- `GET /monitors/:pubkey/analytics` - Monitor reliability scores
- `GET /monitors/analytics` - All monitor analytics

#### Policy
- `GET /policy` - Get aggregation policy
- `PUT /policy` - Update policy (requires auth)

#### Subscriptions
- `POST /subscriptions` - Create subscription
- `GET /subscriptions/events` - SSE event stream
- `GET /subscriptions/:id` - Get subscription details
- `DELETE /subscriptions/:id` - Cancel subscription

### REST Configuration

```bash
# Enable REST API
REST_ENABLED=true

# Network
REST_HOST=127.0.0.1
REST_PORT=3000

# CORS
REST_CORS_ORIGINS=http://localhost:3000
# Or allow all: REST_CORS_ORIGINS=*

# Features
REST_ENABLE_SWAGGER=true
REST_ALLOW_POLICY_UPDATE=false

# Rate Limiting
REST_RATE_LIMIT_ENABLED=true
REST_RATE_LIMIT_RPS=10           # 10 tokens per second
REST_RATE_LIMIT_BURST=100        # 100 token bucket size
```

### Rate Limit Costs

Different operations consume different amounts of rate limit tokens:

- Standard GET: 1 token
- Search queries: 3 tokens
- Monitor analytics: 2 tokens
- Compare (5+ relays): 5 tokens
- POST/PUT/DELETE: 2 tokens
- Policy updates: 10 tokens
- Subscriptions: 2 tokens

Example: With `REST_RATE_LIMIT_RPS=10` and `BURST=100`:
- Light usage: ~10 standard requests/sec
- Heavy usage (search/compare): ~2-3 requests/sec
- Policy updates: 1 per second max

## HTTP 402 Payments (REST API)

RelayVM supports optional payment gating for expensive REST endpoints using HTTP 402 (Payment Required).

### Payment Methods

Two payment methods are supported:

1. **L402 (Lightning)**: Pay-per-request using Lightning Network invoices
2. **P2PK (Cashu)**: Pay with Cashu ecash tokens using P2PK (Pay-to-Public-Key)

### Configuration

Enable payments with feature flags and provider configuration:

```bash
# Enable 402 payments
FEATURE_402=true

# L402 (Lightning) Configuration
FEATURE_402_L402=true
L402_ROOT_KEY=<hex-encoded-secret>    # For generating invoice macaroons
LND_REST_URL=https://your-lnd:8080
LND_MACAROON_HEX=<admin-macaroon-hex>

# P2PK (Cashu) Configuration
FEATURE_402_P2PK=true
CASHU_MINT_URL=https://mint.example.com
CASHU_P2PK_PUBKEY=<your-public-key-hex>
CASHU_P2PK_PRIVATE_KEY=<your-private-key-hex>

# Receipt Storage (optional, recommended for production)
REDIS_URL=redis://localhost:6379

# Pricing Policy File
PAY_PRICES_JSON=./config/payments.prices.json
```

### Pricing Policy

Create a `config/payments.prices.json` file (see `payments.prices.example.json`):

```json
{
  "defaults": {
    "priceMsat": 0,
    "methods": ["L402", "P2PK"],
    "ttlSeconds": 3600
  },
  "routes": {
    "/relays": { "priceMsat": 0 },
    "/relays/search": { "priceMsat": 5000 },
    "/relays/compare": { "priceMsat": 15000, "methods": ["L402"] },
    "/monitors/analytics": { "priceMsat": 1000 }
  }
}
```

**Price Units**: `priceMsat` is in millisatoshis (1 sat = 1000 msat)

### Usage Flow

1. **Client makes request without payment**:
```bash
curl -X POST http://localhost:3000/relays/compare \
  -H "Content-Type: application/json" \
  -d '{"urls": ["wss://relay1.com", "wss://relay2.com"]}'
```

2. **Server responds with 402 and payment challenge**:
```http
HTTP/1.1 402 Payment Required
WWW-Authenticate: L402 invoice="lnbc..."
WWW-Authenticate: P2PK mint="https://mint.com" pubkey="02abc..."
Content-Type: application/json

{"error": "Payment Required"}
```

3. **Client pays invoice (L402) or generates proof (P2PK)**

4. **Client retries with Authorization header**:

**L402 Example**:
```bash
curl -X POST http://localhost:3000/relays/compare \
  -H "Authorization: L402 <macaroon>:<preimage>" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["wss://relay1.com", "wss://relay2.com"]}'
```

**P2PK Example**:
```bash
curl -X POST http://localhost:3000/relays/compare \
  -H "Authorization: Cashu <ecash-token>" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["wss://relay1.com", "wss://relay2.com"]}'
```

5. **Server verifies payment and returns data**

### Security

- **Receipt Storage**: Use Redis to prevent replay attacks (same receipt used twice)
- **TTL**: Receipts expire after `ttlSeconds` (default: 1 hour)
- **Fail-Closed**: Payment errors return 402 (safe default)

### Development

Disable payments for development:

```bash
# Simply don't set FEATURE_402 or set it to false
FEATURE_402=false
```

Or set all routes to price 0:

```json
{
  "defaults": { "priceMsat": 0 }
}
```

### Currently Gated Endpoints

- `POST /relays/compare` - 15,000 msat (15 sats) - L402 only
- `POST /relays/search` - 5,000 msat (5 sats) - L402 or P2PK
- `GET /monitors/analytics` - 1,000 msat (1 sat) - L402 or P2PK

*Note: Payment gating is being expanded to additional heavy endpoints*

## MCP Tools

### Health (1 tool)
- `health/ping` - Server health and version information

### Relay Query Tools (16 tools)
- `relays/list` - Paginated relay list with sorting
- `relays/get_state` - Single relay detailed state
- `relays/search` - Filter by network, NIPs, software, labels, latency, support
- `relays/nearby` - Find relays within a radius of a point
- `relays/bbox` - Find relays within a bounding box
- `relays/get_labels` - Get labels for a specific relay
- `relays/list_labels` - List all available labels across all relays
- `relays/by_label` - Find relays with a specific label
- `relays/by_software` - Group relays by software family
- `relays/by_network` - Group relays by network type (clearnet, tor, i2p, hybrid)
- `relays/by_nip` - Group relays by NIP support with average support ratios
- `relays/by_country` - Group relays by country (using labels)
- `relays/compare` - Side-by-side comparison of multiple relays
- `relays/online` - Relays with recent successful open (window configurable)
- `relays/offline` - Recently seen relays with no open within threshold
- `relays/dead_probably` - Relays not seen for a long time

### Monitor Tools (2 tools)
- `monitors/get` - Get information about a specific monitor
- `monitors/list` - List all known monitors with their parameters

### Policy Tools (2 tools)
- `policy/get` - Get current aggregation policy configuration
- `policy/set` - Update policy (requires authorization)

### Subscription Tools (2 tools)
- `relays/subscribe_state` - Subscribe to relay state changes
- `relays/unsubscribe` - Cancel subscription

**Total: 21 MCP tools**

## Configuration Reference

### Required

- `CVM_RELAYS`: Comma-separated wss:// URLs for server transport
- `INGEST_RELAYS`: Comma-separated wss:// URLs for NIP-66 ingestion
- `CVM_SERVER_NSEC`: Server private key (nsec1... or 64-char hex)

### Authentication & Security

- `CVM_ENCRYPTION_MODE`: OPTIONAL (default) | REQUIRED | DISABLED
- `CVM_ALLOWED_PUBKEYS`: Comma-separated hex pubkeys for policy mutations (empty = no restrictions)
- `CVM_AUTH_ENABLED`: true (default) | false
- `CVM_AUTH_ALLOW_ANY`: true | false (default) - Accept any authenticated pubkey

### Logging

- `LOG_LEVEL`: trace | debug | info (default) | warn | error | fatal
- `LOG_DESTINATION`: stdout (default) | stderr | file
- `LOG_FILE`: Path to log file (required if LOG_DESTINATION=file)
- `LOG_ENABLED`: true (default) | false

### REST API

- `REST_ENABLED`: true | false (default)
- `REST_HOST`: 127.0.0.1 (default)
- `REST_PORT`: 3000 (default)
- `REST_CORS_ORIGINS`: http://localhost:3000 (default) | * for all
- `REST_ENABLE_SWAGGER`: true (default) | false
- `REST_ALLOW_POLICY_UPDATE`: false (default) | true
- `REST_RATE_LIMIT_ENABLED`: true (default) | false
- `REST_RATE_LIMIT_RPS`: 10 (default) - Tokens per second
- `REST_RATE_LIMIT_BURST`: 100 (default) - Token bucket size

### Cache

- `CACHE_MAX_SIZE`: 10000 (default) - Maximum cache entries
- `CACHE_TTL_SECONDS`: 60 (default) - Default TTL in seconds

### Aggregation Policy

- `AGG_LOOKBACK_SECONDS`: 21600 (default, 6 hours) - Observation window
- `AGG_QUORUM`: 0.5 (default) - Min support ratio for booleans
- `AGG_LABEL_QUORUM`: 0.3 (default) - Min support ratio for labels/sets
- `AGG_MAD_SCALE`: 3.0 (default) - MAD multiplier for outlier rejection

### Structured Outputs (Experimental)

- `CVM_STRUCTURED_CONTENT`: true | false (default)
- `CVM_EXPOSE_TOOL_SCHEMAS`: true | false (default)
- `CVM_MAX_TEXT_RESPONSE_BYTES`: 100000 (default)

## Architecture

```
Nostr Relays → Ingestion Pipeline → Normalization → Observations Store
                                                          ↓
                                            Aggregation Engine (30s)
                                                          ↓
                                  RelayState + Label Index + Geo Index
                                                          ↓
                              ┌──────────────────────────┴──────────────┐
                              ↓                                         ↓
                    MCP Server (Nostr)                         REST API (HTTP)
                              ↓                                         ↓
                    AI Agents, Claude Desktop              Web/Mobile Apps
```

## Performance

### Caching Strategy

- **Query Cache**: 60-second TTL with LRU eviction
- **Max Size**: 10,000 entries (configurable)
- **Hit Rate**: Typically 70-90% for repeated queries
- **Periodic Eviction**: Expired entries removed every 30 seconds
- **Cache Stats**: Available in health endpoints

### Monitoring

Health endpoints (`/health/ping` and `health/ping` tool) provide:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600,
  "relayCount": {
    "transport": 2,
    "ingestion": 2
  },
  "observationCount": 1234,
  "cache": {
    "size": 856,
    "maxSize": 10000,
    "hits": 12543,
    "misses": 2341,
    "hitRate": 0.842,
    "hitRatePercent": 84.2
  },
  "metrics": {
    "ingestion": { ... },
    "aggregation": { ... },
    "subscriptions": { ... }
  }
}
```

## Security

### Production Checklist

- [ ] Set `REST_CORS_ORIGINS` explicitly (not `*`)
- [ ] Use HTTPS with TLS termination
- [ ] Configure `CVM_ALLOWED_PUBKEYS` for policy mutations
- [ ] Enable rate limiting (`REST_RATE_LIMIT_ENABLED=true`)
- [ ] Review `CACHE_MAX_SIZE` based on available memory
- [ ] Set up monitoring and alerting on health endpoints
- [ ] Configure log aggregation (`LOG_DESTINATION=file`)

### Security Features

- **HSTS**: Automatic when request is HTTPS
- **CSP**: `default-src 'none'; frame-ancestors 'none'`
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **Request Size Limits**: 1MB max body size
- **Connection Timeouts**: 30s connection, 65s keepalive
- **Error Sanitization**: 5xx errors don't leak stack traces
- **Input Validation**: Comprehensive validation on all inputs

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
COPY .env .env
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Docker Compose

See `docker-compose.yml` for a complete example with:
- RelayVM server
- Nginx reverse proxy with TLS
- Let's Encrypt SSL certificates
- Health checks
- Logging

### Environment Variables in Production

```bash
# Use Docker secrets or encrypted environment
docker run -e CVM_SERVER_NSEC="$(cat /run/secrets/server-key)" relayvm
```

## Development

### Project Structure

```
src/
├── config.ts               # Configuration system
├── index.ts                # Main entry point with signal handlers
├── server.ts               # CVM server orchestration
├── core/                   # State management core
│   ├── api.ts             # Public query API
│   ├── state-manager.ts   # State computation
│   ├── label-index.ts     # Label indexing
│   ├── geo.ts             # Geospatial queries
│   └── cache/             # Cache services
├── services/              # Business logic services
│   ├── ingestion.ts       # NIP-66 event ingestion
│   ├── observation-store.ts
│   ├── subscription-manager.ts
│   ├── notification-delivery.ts
│   ├── metrics.ts
│   ├── security.ts
│   ├── rate-limiter.ts
│   └── cache.ts
├── rest/                  # REST API
│   ├── server.ts          # Fastify server setup
│   ├── routes/            # Route handlers
│   ├── schemas.ts         # Response schemas
│   └── sse-delivery.ts    # Server-Sent Events
├── mcp/                   # MCP adapter
│   └── tool-adapter.ts
├── tools/                 # MCP tool implementations
│   ├── health.ts
│   ├── relays.ts
│   ├── monitors.ts
│   ├── policy.ts
│   └── subscriptions.ts
├── types/                 # TypeScript types
└── utils/                 # Utilities
test/
├── parity.test.ts        # MCP/Core parity tests
├── security.test.ts      # Security validation tests
└── rest-integration.test.ts  # REST API tests
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/parity.test.ts

# Run with coverage
npm test -- --coverage
```

**Test Suites:**
- `parity.test.ts`: 28 tests validating MCP tool parity with core
- `security.test.ts`: Input validation, injection prevention
- `rest-integration.test.ts`: REST endpoint security and features

## Troubleshooting

### Common Issues

**Rate limit exceeded:**
- Check `X-RateLimit-Remaining` header
- Wait for `Retry-After` seconds
- Increase `REST_RATE_LIMIT_RPS` or `REST_RATE_LIMIT_BURST`

**Cache not working:**
- Check cache stats in health endpoint
- Verify `CACHE_MAX_SIZE` not too small
- Check for high eviction rate

**CORS errors:**
- Set `REST_CORS_ORIGINS` to your domain
- Include protocol: `http://localhost:3000` not `localhost:3000`

**Subscriptions timing out:**
- SSE connections are exempt from rate limiting
- Check firewall/proxy keepalive settings (65s default)

## Developer Tools

RelayVM includes comprehensive tooling for development and operations:

- **CLI Tool**: Configuration validation, health checks, relay testing, key generation
- **Development Utilities**: Profiling, mock data generation, state validation, benchmarking
- **Client Generation**: Type-safe TypeScript client via ctxcn

See [TOOLING.md](TOOLING.md) for complete documentation.

## Contributing

See `AGENTS.md` for development guidelines.

## License

MIT
### Payments Health

- Endpoint: `GET /health/payments`
- Returns status for payments backends when `FEATURE_402` is enabled:
  - `featureEnabled`: boolean
  - `lnd.grpc`: `{ configured, ok?, reason? }` when `LND_GRPC_HOST` and either `LND_PROTO_DIR` or `LND_PROTO_JSON_PATH` are set (and `LND_MACAROON_HEX`)
  - `lnd.rest`: `{ configured, ok?, reason? }` when `LND_REST_URL` and `LND_MACAROON_HEX` are set
  - `p2pk`: `{ configured }` when `CASHU_MINT_URL` is set

Environment variables:
- `FEATURE_402=true|false`
- `PAY_PRICES_JSON=./config/payments.prices.json`
- L402: `L402_ROOT_KEY=<64-hex>`
- LND (gRPC preferred):
  - `LND_GRPC_HOST=127.0.0.1:10009`
  - `LND_MACAROON_HEX=<hex>`
  - Either `LND_PROTO_DIR=/opt/lnd/lnrpc` or `LND_PROTO_JSON_PATH=/path/to/lnd-lightning.json`
  - Optional: `LND_TLS_CERT_PATH=/etc/lnd/tls.cert`
- LND (REST fallback): `LND_REST_URL=https://127.0.0.1:8080`, `LND_MACAROON_HEX=<hex>`
- Cashu P2PK (optional): `CASHU_MINT_URL=https://mint.example.com`, `CASHU_P2PK_PUBKEY=<pubkey>`
