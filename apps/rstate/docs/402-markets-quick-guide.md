# 402.markets Quick Implementation Guide

**Quick Reference for RelayVM 402.markets Compatibility**

---

## ✅ Current Status: 80% Ready

RelayVM already implements most requirements for 402.markets listing:

| Feature | Status | Location |
|---------|--------|----------|
| OpenAPI 3.0 Schema | ✅ DONE | `/docs/json` endpoint |
| HTTP 402 Responses | ✅ DONE | `/src/rest/payments.ts` |
| L402 Protocol | ✅ DONE | Via `nostrwatch-payments-gateway` |
| Compact Responses | ✅ DONE | `?compact=true` query parameter |
| Payment Challenges | ✅ DONE | WWW-Authenticate headers |
| Receipt Storage | ✅ DONE | Redis-based replay protection |
| Dynamic Pricing | ✅ DONE | JSON policy: `PAY_PRICES_JSON` |

---

## 🎯 What You Need to Do

### 1. Enable Payments (If Not Already)

```bash
# .env configuration
FEATURE_402=true
FEATURE_402_L402=true

# L402 (Lightning) - Choose gRPC (preferred) or REST
LND_GRPC_HOST=127.0.0.1:10009
LND_MACAROON_HEX=<your-macaroon-hex>
LND_PROTO_DIR=/path/to/lnd/lnrpc  # OR LND_PROTO_JSON_PATH=/path/to/lnd-lightning.json
LND_TLS_CERT_PATH=/path/to/tls.cert  # Optional

# Alternatively, use LND REST
LND_REST_URL=https://127.0.0.1:8080
LND_MACAROON_HEX=<your-macaroon-hex>

# Receipt storage (recommended)
REDIS_URL=redis://localhost:6379

# Pricing policy
PAY_PRICES_JSON=./config/payments.prices.json
```

### 2. Configure Pricing

Create `config/payments.prices.json`:

```json
{
  "defaults": {
    "priceMsat": 0,
    "methods": ["L402"],
    "ttlSeconds": 3600
  },
  "routes": {
    "/relays": { "priceMsat": 0 },
    "/relays/search": { "priceMsat": 5000 },
    "/relays/compare": { "priceMsat": 15000 },
    "/monitors/analytics": { "priceMsat": 1000 }
  }
}
```

**Price Guide:**
- 1 sat = 1,000 millisatoshis (msat)
- Free tier: 0 msat (discovery endpoints)
- Light queries: 1,000-5,000 msat (1-5 sats)
- Heavy queries: 10,000-20,000 msat (10-20 sats)

### 3. Test Payment Flow

```bash
# 1. Trigger payment requirement
curl -X POST http://localhost:3000/relays/compare \
  -H "Content-Type: application/json" \
  -d '{"urls": ["wss://relay.damus.io", "wss://relay.nostr.band"]}'

# Response:
# HTTP/1.1 402 Payment Required
# WWW-Authenticate: L402 invoice="lnbc15000n1..."

# 2. Pay invoice (using your Lightning wallet)
lncli payinvoice <invoice-from-response>

# 3. Retry with authorization
curl -X POST http://localhost:3000/relays/compare \
  -H "Authorization: L402 <macaroon>:<preimage>" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["wss://relay.damus.io", "wss://relay.nostr.band"]}'

# Success! Returns comparison data
```

---

## 🚀 402.markets Listing Checklist

### Required for Listing

- [ ] **OpenAPI Spec Available**
  ```bash
  curl http://localhost:3000/docs/json > relayvm-openapi.json
  ```

- [ ] **Payment Flow Tested**
  - Successfully generated 402 response
  - Paid Lightning invoice
  - Verified authorization works
  - Checked receipt replay protection

- [ ] **Documentation Complete**
  - README includes payment instructions ✅
  - API examples provided ✅
  - Pricing clearly documented ✅

- [ ] **Nostr Metadata Created** (NEEDED)
  ```json
  {
    "kind": 31990,
    "content": {
      "name": "RelayVM API",
      "description": "NIP-66 relay intelligence aggregation",
      "openapi_url": "https://your-domain.com/docs/json",
      "base_url": "https://your-domain.com",
      "payment_methods": ["L402"],
      "tags": ["nostr", "nip-66", "relays", "monitoring"]
    }
  }
  ```

### Recommended Before Listing

- [ ] **Production Environment Ready**
  - HTTPS/TLS configured
  - Lightning node stable
  - Redis backup configured
  - Monitoring enabled

- [ ] **Pricing Optimized**
  - Competitive with similar APIs
  - Fair computational cost basis
  - Clear value proposition

- [ ] **Rate Limiting Configured**
  ```bash
  REST_RATE_LIMIT_ENABLED=true
  REST_RATE_LIMIT_RPS=10
  REST_RATE_LIMIT_BURST=100
  ```

---

## 📊 Response Format Options

### Compact Responses (Recommended for Paid Endpoints)

```bash
# Add ?compact=true to any endpoint
curl 'http://localhost:3000/relays?limit=10&compact=true'
curl 'http://localhost:3000/relays/search?compact=true' \
  -X POST -H "Content-Type: application/json" \
  -d '{"filter": {"nips": [42]}}'
```

**Benefits:**
- 30-35% smaller payload size
- Removes `contributingAuthors` fields (privacy)
- Faster parsing and lower bandwidth costs
- Same data quality and completeness

**When to use:**
- Mobile/cellular connections
- High-frequency queries
- Bandwidth-constrained environments
- Cost-sensitive applications

### Verbose Responses (Default)

Default format includes full metadata for debugging and transparency.

**When to use:**
- Development and debugging
- Human-readable needs
- Maximum transparency required
- First-time API exploration

---

## 💰 Pricing Best Practices

### Competitive Pricing Strategy

**Free Tier (Discovery):**
- `GET /relays` - List relays (paginated)
- `GET /relays/state?relayUrl=X` - Single relay
- `GET /health/ping` - Health check
- `GET /monitors` - List monitors

**Paid Tier (Computation):**
- `POST /relays/search` - 5 sats (filter/sort operations)
- `POST /relays/compare` - 15 sats (multi-relay comparison)
- `GET /monitors/analytics` - 1 sat (aggregate statistics)

**Dynamic Pricing (Future):**
- Scale cost by query complexity
- Example: Compare 2 relays = 5 sats, 10 relays = 25 sats
- Implement via pricing policy override logic

---

## 🔧 Troubleshooting

### Payment Challenges Not Appearing

```bash
# Check payments feature enabled
grep FEATURE_402 .env

# Should show:
# FEATURE_402=true
# FEATURE_402_L402=true

# Check LND configuration
curl http://localhost:3000/health/payments
```

### Authorization Failures

Common issues:
1. **Invalid preimage** - Wrong payment or expired invoice
2. **Receipt replay** - Same receipt used twice
3. **Expired TTL** - Receipt older than configured TTL
4. **Wrong format** - Must be `Authorization: L402 <macaroon>:<preimage>`

Check logs:
```bash
tail -f logs/relayvm.log | grep payment
```

### Lightning Node Issues

```bash
# Test LND connection (gRPC)
lncli getinfo

# Test LND connection (REST)
curl https://localhost:8080/v1/getinfo \
  --cacert /path/to/tls.cert \
  --header "Grpc-Metadata-macaroon: $(xxd -ps -u -c 1000 /path/to/admin.macaroon)"

# Check RelayVM can reach LND
curl http://localhost:3000/health/payments
```

---

## 📚 Additional Resources

**Full Research Document:**
- `/docs/402-markets-research.md` - Comprehensive 13-section analysis

**RelayVM Documentation:**
- `/README.md` - Main documentation with payment section
- `/API-EXAMPLES.md` - Language-specific client examples
- `/AGENTS.md` - Development guidelines

**External Resources:**
- **402.markets:** https://402.markets/
- **L402 Protocol:** https://github.com/lightninglabs/L402
- **Lightning Labs:** https://docs.lightning.engineering/the-lightning-network/l402
- **OpenAPI 3.0:** https://spec.openapis.org/oas/v3.0.3

---

## 🎯 Quick Wins

1. **Already Implemented:**
   - Payment infrastructure (L402 + P2PK)
   - Compact response format
   - OpenAPI documentation
   - Receipt replay protection

2. **Easy Additions:**
   - Nostr metadata event (30 minutes)
   - Pricing optimization (1 hour)
   - Production testing (2 hours)

3. **Total Time to 402.markets:**
   - **4-6 hours** from current state to live listing

---

**TLDR:** RelayVM is nearly ready for 402.markets. Enable payments in `.env`, configure pricing policy, test the flow, create Nostr metadata, and submit!

---

*Quick reference guide generated from comprehensive research*
*See `/docs/402-markets-research.md` for full analysis*
