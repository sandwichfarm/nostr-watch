# @nostrwatch/redis

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/redis` runs a BullMQ queue monitoring dashboard for the nostr-watch monorepo. It launches a Fastify HTTP server with the bull-board UI, connecting to Redis to inspect queue state across one or more regional worker processes. Developers use it during local development to observe job throughput, failures, and retries in the BullMQ queues that drive relay monitoring.

## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/redis --filter @nostrwatch/your-package
```

It is not published to npm.

## Quick Start

Start the dashboard server directly:

```sh
node index.js
```

The server listens on `http://0.0.0.0:3030/f` by default. Configure the Redis connection and monitored regions using environment variables (see Configuration).

## Configuration

Set the following environment variables before starting the server. Create a `.env` file in this directory or set them in your shell.

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_USER` | _(empty)_ | Redis ACL username (optional) |
| `REDIS_PASS` | _(empty)_ | Redis password (optional) |
| `REDIS_TLS` | `false` | Enable TLS for the Redis connection |
| `REGIONS` | _(empty)_ | Comma-separated list of region names to monitor (e.g. `us-east,eu-west`) |

### Local Redis with Docker

A `docker-compose.yaml` is included for running Redis locally:

```sh
docker compose up -d
```

This starts Redis on the default port 6379 with data persisted to `.redis/`.

## Known Limitations

No known limitations at this time.

## License

[MIT](../../LICENSE)
