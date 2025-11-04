# Development Setup Guide

## 🚨 CRITICAL: Relay Configuration

### Two Types of Relays

The relay-state application uses **two separate relay configurations**:

1. **Transport Relays (`CVM_RELAYS`)** - For MCP/Nostr communication
   - **MUST be LOCAL ONLY** to prevent polluting production with test data
   - Use `nak serve` (in-memory relay)
   - Default: `ws://localhost:6969`

2. **Ingestion Relays (`INGEST_RELAYS`)** - For NIP-66 data ingestion
   - **SHOULD be PRODUCTION** to get real live data
   - Real NIP-66 data is difficult to mock
   - Examples: `wss://relay.nostr.watch`, `wss://relay.nostr.band`

### Why This Matters

**❌ NEVER use production relays for transport!**

If you use production relays (like `wss://relay.contextvm.org`) for `CVM_RELAYS`, you will:
- Pollute production relays with local development test data
- Interfere with real production services
- Create noise in production monitoring

The codebase now has **guards** to prevent this:
- `src/config.ts` validates that `CVM_RELAYS` are localhost only
- Will throw an error if production relays are detected
- Will warn about any non-local relays

## Quick Start

### 1. Install Dependencies

```bash
npm install

# Install nak for local relay (if not installed)
go install github.com/fiatjaf/nak@latest
```

### 2. Start Local Relay

```bash
# Terminal 1: Start nak in-memory relay
nak serve --port 6969
```

### 3. Configure Environment

```bash
# Copy safe development config
cp .env.development.safe .env

# Or manually create .env with:
CVM_RELAYS=ws://localhost:6969
INGEST_RELAYS=wss://relay.nostr.watch,wss://relay.nostr.band
CVM_SERVER_NSEC=$(nak key generate)
# ... other config
```

### 4. Start Development Server

```bash
# Terminal 2: Start dev server
npm run dev
```

## Running Tests

### Unit/Integration Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- compact-mode.test.ts

# Watch mode
npm test -- --watch
```

### Smoke Tests

Smoke tests require a running server:

```bash
# Option 1: Use automated script (recommended)
./test/run-smoke-tests.sh

# Option 2: Manual
# Terminal 1: Start nak relay
nak serve --port 6969

# Terminal 2: Start server
npm run dev

# Terminal 3: Run smoke tests
SMOKE_SERVER_PUBKEY=<pubkey> pnpm test:smoke:full
```

## Configuration Reference

### Environment Variables

| Variable | Purpose | Required | Example |
|----------|---------|----------|---------|
| `CVM_RELAYS` | Transport relays (LOCAL ONLY!) | Yes | `ws://localhost:6969` |
| `INGEST_RELAYS` | Ingestion relays (production OK) | Yes | `wss://relay.nostr.watch` |
| `CVM_SERVER_NSEC` | Server private key | Yes | Generate with `nak key generate` |
| `REST_ENABLED` | Enable REST API | No | `true` (default: false) |
| `REST_PORT` | REST API port | No | `3000` |
| `LOG_LEVEL` | Logging level | No | `info` |

### Safe Development Defaults

See `.env.development.safe` for a complete safe configuration template.

## Common Issues

### "CRITICAL: CVM_RELAYS contains PRODUCTION relay"

**Problem**: You're trying to use a production relay for transport.

**Solution**: Update `.env` to use `ws://localhost:6969` and start `nak serve --port 6969`

### "Failed to connect to relay"

**Problem**: Local nak relay isn't running.

**Solution**: Start nak relay first: `nak serve --port 6969`

### Tests failing with empty relay states

**Problem**: Test data setup or server not properly initialized.

**Solution**: Ensure tests use proper `RelayObservation` format (see `test/compact-mode.test.ts` for examples)

## Architecture

```
┌─────────────────────────────────────────┐
│  Client (MCP over Nostr)                │
└────────────┬────────────────────────────┘
             │
      CVM_RELAYS (LOCAL ONLY!)
             │
┌────────────▼────────────────────────────┐
│  relay-state Server                     │
│  - MCP Tools (query interface)          │
│  - REST API (HTTP interface)            │
│  - State Core (aggregation)             │
└────────────┬────────────────────────────┘
             │
    INGEST_RELAYS (Production OK)
             │
┌────────────▼────────────────────────────┐
│  NIP-66 Monitors (Production Data)      │
│  - Real relay observations              │
│  - Monitor announcements                │
│  - Live network data                    │
└─────────────────────────────────────────┘
```

## Production vs Development

| Aspect | Development | Production |
|--------|-------------|-----------|
| Transport Relay | `ws://localhost:6969` (nak) | `wss://relay.contextvm.org` |
| Ingestion Relay | `wss://relay.nostr.watch` | `wss://relay.nostr.watch` |
| Server Key | Ephemeral (generated) | Persistent (secure) |
| REST API | Enabled | Optional |
| Logging | `info` or `debug` | `warn` or `error` |

## Security Notes

1. **Never commit `.env` file** - Contains private keys
2. **Use ephemeral keys for development** - Generate with `nak key generate`
3. **Keep production keys secure** - Use environment variables in production
4. **Local relay only for transport** - Prevents accidental data pollution

## Additional Resources

- [NIP-66 Specification](https://github.com/nostr-protocol/nips/blob/master/66.md)
- [MCP Documentation](https://contextvm.org/docs)
- [nak Documentation](https://github.com/fiatjaf/nak)
