# Getting Started

A guide to setting up the nostr-watch monorepo for local development.

## Prerequisites

- **Node.js** >= 20 (managed via [Volta](https://volta.sh/) — `volta install node`)
- **pnpm** >= 8 (`npm install -g pnpm` or see [pnpm install docs](https://pnpm.io/installation))
- **Git**

Optional (for specific packages):
- **Deno** >= 1.4 — required for `apps/trawler`
- **Docker** + Docker Compose — required for `apps/docker-stacks` and local infrastructure

## Setup

```bash
# Clone the repository
git clone https://github.com/sandwichfarm/nostr-watch.git
cd nostr-watch

# Install all workspace dependencies
pnpm install
```

## Common Workflows

### Build all packages

```bash
pnpm build
```

### Run tests

```bash
# Run tests for all packages
pnpm -r test

# Run tests for a specific package
pnpm --filter @nostrwatch/auditor test
```

### Start the docs site locally

```bash
pnpm docs:dev
```

Then open [http://localhost:5173](http://localhost:5173).

### Lint documentation

```bash
pnpm lint:docs
```

### Work on a specific app

```bash
# Start the GUI in dev mode
pnpm --filter @nostrwatch/gui dev

# Start the relay state machine
pnpm --filter @nostrwatch/rstate dev
```

## Monorepo Structure

Packages are organized into three directories:

- `apps/` — Product applications (services, dashboards)
- `libraries/` — Shared reusable libraries
- `internal/` — Internal infrastructure (logging, caching, utilities)

Cross-package imports use `@nostrwatch/*` scoped names, resolved automatically by pnpm workspaces.

## Next Steps

- [Architecture Overview](./architecture.md) — Understand how packages relate
- [All Packages](./packages/) — Browse the full package catalog
