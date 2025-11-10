# RelayMon Health Monitoring System

Comprehensive health monitoring for RelayMon with HTTP endpoints, CLI health checks, and Uptime Kuma integration.

## Overview

The health monitoring system tracks the health of the RelayMon process itself (not the relays it monitors). It provides:

- **Three health states**: Up, Degraded, Down
- **HTTP health server**: JSON endpoints for health checks and metrics
- **CLI health check**: `--health` flag for scripting and external monitoring
- **Uptime Kuma integration**: Push health status to Uptime Kuma
- **Env-only secrets**: No secrets in config files

## Health States

### Up
Process is healthy:
- Process alive and responsive
- Check loop advancing (enqueuing work)
- Database responding
- Signing capability verified
- Queues processing normally

### Degraded
Process is functional but experiencing issues:
- High publish queue backlog
- Check loop idle (but no expired work waiting)
- High error rate (soft threshold)
- Publish success rate low

### Down
Process has critical failures:
- Database connection failed
- Signing self-test failed
- Check loop stalled with expired work waiting
- Fatal configuration errors

## Configuration

Add the `health` section to your `config.yaml`:

```yaml
health:
  enabled: true

  server:
    enabled: true
    host: "127.0.0.1"
    port: 8080
    authEnabled: false

  kuma:
    enabled: true
    intervalMs: 60000
    degradedAsUp: true
    startupGraceMs: 30000
    msgVerbosity: "summary"

  thresholds:
    checkIdleMs: 300000
    publishBacklogMax: 100
    errorRatePerMin: 10
    startupGraceMs: 30000
```

See `health-config.example.yaml` for a complete example with documentation.

## Environment Variables

**All secrets must be provided via environment variables, never in config files.**

### Kuma Push URL

Choose one of two patterns:

**Pattern 1: Full push URL**
```bash
RELAYMON_KUMA_PUSH_URL=https://uptime.example.com/api/push/YOUR_TOKEN
```

**Pattern 2: Base URL + Token**
```bash
RELAYMON_KUMA_BASE_URL=https://uptime.example.com
RELAYMON_KUMA_TOKEN=YOUR_TOKEN
```

### File-Based Secrets

For Docker/Kubernetes, use `_FILE` variants:

```bash
RELAYMON_KUMA_PUSH_URL_FILE=/run/secrets/kuma_push_url
RELAYMON_KUMA_TOKEN_FILE=/run/secrets/kuma_token
RELAYMON_HEALTH_AUTH_TOKEN_FILE=/run/secrets/health_auth_token
RELAYMON_NSEC_FILE=/run/secrets/nsec
```

**Precedence**: `_FILE` → raw env → disabled

### Health Server Auth (Optional)

```bash
RELAYMON_HEALTH_AUTH_TOKEN=your-secret-token
```

## HTTP Endpoints

When the health server is enabled, the following endpoints are available:

### `GET /healthz` or `GET /health`

Health check endpoint that returns minimal status.

**Status Codes:**
- `200` - Up or Degraded
- `503` - Down

**Response:**
```json
{
  "status": "up",
  "timestamp": "2025-01-10T12:34:56.789Z",
  "uptime": 123456,
  "reasons": ["All systems operational"]
}
```

### `GET /metrics`

Full health snapshot with all metrics.

**Status Code:** `200`

**Response:**
```json
{
  "state": "up",
  "timestamp": "2025-01-10T12:34:56.789Z",
  "uptime": 123456,
  "checks": {
    "database": {
      "name": "database",
      "status": "pass",
      "message": "Database healthy",
      "data": { "queryTimeMs": 2 },
      "timestamp": "2025-01-10T12:34:56.789Z"
    },
    "signing": { /* ... */ },
    "checkQueue": { /* ... */ },
    "publishQueue": { /* ... */ },
    "checkLoop": { /* ... */ }
  },
  "metrics": {
    "checkQueue": {
      "pending": 5,
      "completed": 1234,
      "failed": 0,
      "enqueued": 10
    },
    "publishQueue": {
      "pending": 3,
      "published": 567,
      "failed": 2,
      "retrying": 1,
      "successRate": 0.996
    },
    "errors": {
      "lastMinute": 0,
      "lastFiveMinutes": 1
    },
    "checkLoop": {
      "lastHeartbeat": "2025-01-10T12:34:50.000Z",
      "timeSinceHeartbeat": 6789,
      "expiredRelaysWaiting": 0
    }
  },
  "reasons": ["All systems operational"]
}
```

### `GET /`

Returns available endpoints.

### Authentication

If `authEnabled: true`, include token in header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/healthz
```

Or just:

```bash
curl -H "Authorization: YOUR_TOKEN" http://localhost:8080/healthz
```

## CLI Health Check

Use the `--health` flag to check health from the command line:

```bash
relaymon --health
```

**Exit Codes:**
- `0` - Up or Degraded
- `1` - Down or error

**Output (JSON):**
```json
{
  "status": "up",
  "timestamp": "2025-01-10T12:34:56.789Z",
  "uptime": 123456,
  "checks": {
    "database": "pass",
    "signing": "pass",
    "checkQueue": "pass",
    "publishQueue": "pass",
    "checkLoop": "pass"
  },
  "reasons": ["All systems operational"]
}
```

### Usage in Scripts

```bash
#!/bin/bash
if relaymon --health > /dev/null 2>&1; then
  echo "RelayMon is healthy"
else
  echo "RelayMon is down"
  exit 1
fi
```

### With Custom Config

```bash
relaymon --config custom-config.yaml --health
```

## Uptime Kuma Integration

The health system pushes status to Uptime Kuma automatically when enabled.

### Setup

1. Create a "Push" monitor in Uptime Kuma
2. Copy the push URL
3. Set environment variable:
   ```bash
   RELAYMON_KUMA_PUSH_URL=https://uptime.example.com/api/push/YOUR_TOKEN
   ```
4. Enable in config:
   ```yaml
   health:
     enabled: true
     kuma:
       enabled: true
       intervalMs: 60000
       degradedAsUp: true
       msgVerbosity: "summary"
   ```

### State Mapping

- **Up** → `status=up` with message "All systems operational"
- **Degraded** → `status=up` (if `degradedAsUp: true`) with message "Degraded: reason"
- **Down** → `status=down` with message "Down: reason"

### Message Verbosity

**Summary** (recommended):
- Up: "All systems operational"
- Degraded: "Degraded: High error rate"
- Down: "Down: Database connection failed"

**Detailed**:
- Includes metrics: "State: degraded; Queue: 10 pending; Errors: 5/min"

### Startup Grace Period

The `startupGraceMs` setting prevents false alarms during startup. RelayMon won't push "Down" status until the grace period expires.

### Backoff and Retry

The Kuma pusher implements:
- **Jittered intervals**: ±10% to prevent thundering herd
- **Exponential backoff**: 2x interval on failure (max 16x)
- **Independent operation**: Never blocks main relay checking

## Deployment

### Systemd Service

Add secrets to systemd unit:

```ini
[Service]
Environment="RELAYMON_KUMA_PUSH_URL=https://uptime.example.com/api/push/TOKEN"
Environment="RELAYMON_HEALTH_AUTH_TOKEN=your-secret"
```

Or use `EnvironmentFile`:

```ini
[Service]
EnvironmentFile=/etc/relaymon/secrets.env
```

**`/etc/relaymon/secrets.env`:**
```bash
RELAYMON_KUMA_PUSH_URL=https://uptime.example.com/api/push/TOKEN
RELAYMON_HEALTH_AUTH_TOKEN=your-secret
```

### Docker

**Using environment variables:**
```bash
docker run \
  -e RELAYMON_KUMA_PUSH_URL=https://uptime.example.com/api/push/TOKEN \
  -e RELAYMON_HEALTH_AUTH_TOKEN=your-secret \
  -p 8080:8080 \
  relaymon
```

**Using Docker secrets:**
```bash
docker run \
  -e RELAYMON_KUMA_PUSH_URL_FILE=/run/secrets/kuma_url \
  -e RELAYMON_HEALTH_AUTH_TOKEN_FILE=/run/secrets/health_token \
  -v ./secrets:/run/secrets:ro \
  -p 8080:8080 \
  relaymon
```

**Docker Compose:**
```yaml
services:
  relaymon:
    image: relaymon
    ports:
      - "8080:8080"
    environment:
      - RELAYMON_KUMA_PUSH_URL_FILE=/run/secrets/kuma_url
      - RELAYMON_HEALTH_AUTH_TOKEN_FILE=/run/secrets/health_token
    secrets:
      - kuma_url
      - health_token

secrets:
  kuma_url:
    file: ./secrets/kuma_url.txt
  health_token:
    file: ./secrets/health_token.txt
```

### Kubernetes

**Using Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: relaymon-secrets
type: Opaque
stringData:
  kuma_url: "https://uptime.example.com/api/push/TOKEN"
  health_token: "your-secret"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: relaymon
spec:
  template:
    spec:
      containers:
      - name: relaymon
        image: relaymon
        ports:
        - containerPort: 8080
        env:
        - name: RELAYMON_KUMA_PUSH_URL
          valueFrom:
            secretKeyRef:
              name: relaymon-secrets
              key: kuma_url
        - name: RELAYMON_HEALTH_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: relaymon-secrets
              key: health_token
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 60
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
```

### Ansible

**Playbook:**
```yaml
- name: Deploy RelayMon with health monitoring
  hosts: relaymon_servers
  vars:
    relaymon_kuma_token: "{{ vault_relaymon_kuma_token }}"
    relaymon_health_token: "{{ vault_relaymon_health_token }}"
  tasks:
    - name: Create systemd unit
      template:
        src: relaymon.service.j2
        dest: /etc/systemd/system/relaymon.service
      notify: restart relaymon
```

**Template (`relaymon.service.j2`):**
```ini
[Unit]
Description=RelayMon Nostr Relay Monitor
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/relaymon --config /etc/relaymon/config.yaml
Environment="RELAYMON_KUMA_TOKEN={{ relaymon_kuma_token }}"
Environment="RELAYMON_KUMA_BASE_URL=https://uptime.example.com"
Environment="RELAYMON_HEALTH_AUTH_TOKEN={{ relaymon_health_token }}"
Restart=always

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Health Server Not Starting

**Check config:**
```yaml
health:
  enabled: true
  server:
    enabled: true
```

**Check logs:**
```
Health server listening on http://127.0.0.1:8080
```

**Test manually:**
```bash
curl http://localhost:8080/healthz
```

### Kuma Not Receiving Pushes

**Check config:**
```yaml
health:
  enabled: true
  kuma:
    enabled: true
```

**Verify URL is set:**
```bash
echo $RELAYMON_KUMA_PUSH_URL
```

**Check logs:**
```
Kuma push URL configured: https://****...****
Pushed up (Kuma: up) to Uptime Kuma: All systems operational
```

**Test manually:**
```bash
curl "https://uptime.example.com/api/push/TOKEN?status=up&msg=test&ping="
```

### Signing Self-Test Failing

**Check NSEC is set:**
```bash
echo $RELAYMON_NSEC
```

**Verify format:**
- NIP-19 format: `nsec1...`
- Or hex: 64 character hex string

**Check logs:**
```
Signing self-test passed
```

### Always Shows "Down"

**Check startup grace period:**
```yaml
health:
  thresholds:
    startupGraceMs: 30000  # 30 seconds
```

**Check for errors in logs:**
```
Database connection failed
Signing self-test failed
```

**Use --health flag to diagnose:**
```bash
relaymon --health | jq .
```

## Security

### Secrets Management

✅ **DO:**
- Store secrets in environment variables
- Use `_FILE` variants for container secrets
- Use vault/secrets manager in production
- Restrict file permissions (0600) for secret files

❌ **DON'T:**
- Put secrets in config.yaml
- Commit secrets to git
- Log secrets (automatically redacted)

### Network Security

✅ **DO:**
- Bind health server to `127.0.0.1` for local-only access
- Use reverse proxy (nginx) for external access
- Enable `authEnabled: true` for external access
- Use strong random tokens (32+ characters)

❌ **DON'T:**
- Expose health server to internet without auth
- Reuse tokens across services
- Use predictable tokens

## Health Check Thresholds

Tune thresholds based on your deployment:

```yaml
health:
  thresholds:
    # Check loop idle threshold (ms)
    # How long without heartbeat before considering stalled
    # Default: 300000 (5 minutes)
    checkIdleMs: 300000

    # Publish queue backlog threshold
    # Max pending events before degraded state
    # Default: 100
    publishBacklogMax: 100

    # Error rate threshold (per minute)
    # Errors per minute before degraded state
    # Default: 10
    errorRatePerMin: 10

    # Startup grace period (ms)
    # Don't report Down during initial startup
    # Default: 30000 (30 seconds)
    startupGraceMs: 30000
```

### Tuning Guidelines

**High-traffic monitors:**
```yaml
publishBacklogMax: 500   # More events expected
errorRatePerMin: 50      # More tolerance for transient errors
```

**Low-traffic monitors:**
```yaml
publishBacklogMax: 50    # Sensitive to backlog
errorRatePerMin: 5       # Strict error tolerance
```

**Slow startup:**
```yaml
startupGraceMs: 60000    # 1 minute grace period
```

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                     RelayMon Daemon                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Check Loop   │  │ Publish Queue│  │  Database    │  │
│  │ (heartbeat)  │  │ (metrics)    │  │  (health)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                            │                             │
│                    ┌───────▼────────┐                    │
│                    │ Health System  │                    │
│                    │ (snapshot)     │                    │
│                    └───────┬────────┘                    │
│                            │                             │
│         ┌──────────────────┼──────────────────┐          │
│         │                  │                  │          │
│   ┌─────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐   │
│   │  HTTP     │    │  CLI        │   │  Kuma       │   │
│   │  Server   │    │  --health   │   │  Pusher     │   │
│   │  :8080    │    │  (exit 0/1) │   │  (backoff)  │   │
│   └───────────┘    └─────────────┘   └─────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### File Structure

```
apps/relaymon/src/health/
├── types.ts          # Health types and interfaces
├── checks.ts         # Individual health check functions
├── snapshot.ts       # Health snapshot builder
├── secrets.ts        # Secret loading with _FILE support
├── server.ts         # HTTP health server (Deno.serve)
├── kuma.ts           # Uptime Kuma push client
└── index.ts          # Public API exports
```

## Contributing

When adding new health checks:

1. Add check function to `checks.ts`
2. Update `HealthSnapshot` type in `types.ts`
3. Call check in `buildHealthSnapshot()` in `snapshot.ts`
4. Update state determination logic
5. Add tests (when test infrastructure is in place)

## License

Same as RelayMon parent project.
