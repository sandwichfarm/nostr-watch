Test and Smoke Guide
====================

Overview
- This folder contains all tests and test runner scripts for the CVM (MCP) + REST server.
- MCP smoke tests exercise the Nostr transport and tool registry.
- REST smoke tests exercise the HTTP surface, including subscriptions via SSE.

Key Scripts
- Unit/integration: `npm test`
- MCP smoke: `npm run test:smoke` (test/smoke.ts)
- Full smoke (MCP + REST): `npm run test:smoke:full` (test/smoke-full.ts)
- Watch helper: `npm run test:smoke:watch` → runs `./test/run-smoke-tests.sh`

Server Readiness (important)
- The server performs an initial compute after start; wait for readiness before running tests.
- REST: poll `GET http://<REST_HOST>:<REST_PORT>/health/ping` until `ready: true`.
  Example shell:
  ```bash
  until curl -fsS http://127.0.0.1:3000/health/ping | jq -e '.ready == true' >/dev/null; do
    echo "waiting for server ready..."; sleep 1; done; echo "server ready"
  ```
- MCP: call health/ping tool once `client.connect(transport)` resolves; the tool returns `ready` too.

Environment Variables
- MCP smoke (client transport):
  - `SMOKE_SERVER_PUBKEY` (required): server npub hex key
  - `SMOKE_RELAYS` (optional): comma-separated relay URLs, e.g. `wss://relay.nostr.band`
  - `SMOKE_CLIENT_KEY` (recommended for subscribe tests): hex/private key for the client signer
- Server (for local/testing):
  - `CVM_ENCRYPTION_MODE=OPTIONAL` (simplifies initial handshake)
  - `CVM_SUBS_REQUIRE_AUTH=false` (optional) to allow subscribe/unsubscribe without a client key
  - REST (if testing REST): `REST_ENABLED=true`, `REST_HOST=127.0.0.1`, `REST_PORT=3000`
  - Optional (ctxcn/codegen): `CVM_EXPOSE_TOOL_SCHEMAS=true`

Running Locally
1) Build the server once: `npm run build`
2) Start it in a terminal: `npm run start`
3) In another terminal, wait for readiness, then run smoke:
   - MCP: `npm run test:smoke`
   - Full: `npm run test:smoke:full`

Troubleshooting
- MCP connect timeout:
  - Verify relays reachable and server logs show: transport started, MCP connected.
  - Set `CVM_ENCRYPTION_MODE=OPTIONAL` and ensure allowed pubkeys permit your client.
- Empty relays/list:
  - Ensure `health.ready == true` before tests; the first compute must complete.
- Subscribe auth errors:
  - Provide `SMOKE_CLIENT_KEY` or set `CVM_SUBS_REQUIRE_AUTH=false` for tests.
- 402 routes:
  - If gating is enabled (FEATURE_402=true), ensure policy prices are set or disable for smoke.

Notes for Contributors
- Keep all tests and test runner scripts under `./test/`. Do not add test files at repository root.
- Keep smoke tests resilient: poll readiness and avoid networked dependencies when possible.

