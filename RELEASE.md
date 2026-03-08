# Release Process

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing.

## How it works

1. **Add a changeset** when you make a change that should be released:
   ```bash
   pnpm changeset
   ```
   Select affected packages and bump level (patch/minor/major).

2. **Push to `next`** — the CI workflow detects pending changesets and opens a "Version Packages" PR that bumps versions and updates CHANGELOGs.

3. **Merge the Version Packages PR** — CI publishes updated packages to npm and creates GitHub releases.

## Bump levels

| Level | When to use |
|-------|-------------|
| `patch` | Bug fixes, dependency updates, docs |
| `minor` | New features, non-breaking API additions |
| `major` | Breaking API changes |

## Publishable packages

These packages are published to npm:

- `@nostrwatch/nocap`
- `@nostrwatch/nostrings`
- `@nostrwatch/route66`
- `@nostrwatch/schemata`
- `@nostrwatch/schemata-js-ajv`
- `@nostrwatch/auditor`
- `@nostrwatch/memory-relay`
- `@nostrwatch/logger`
- `@nostrwatch/utils`
- `@nostrwatch/nocap-websocket-adapter-default`
- `@nostrwatch/nocap-info-adapter-default`
- `@nostrwatch/nocap-dns-adapter-default`
- `@nostrwatch/nocap-geo-adapter-default`
- `@nostrwatch/nocap-ssl-adapter-default`
- `@nostrwatch/nocap-every-adapter-default`
- `@nostrwatch/relay-charts`
- `@nostrwatch/relay-chronicle`
- `@nostrwatch/nocap-route66`
- `@nostrwatch/route66-cacheadapter-nostrsqlite`
- `@nostrwatch/route66-wsadapter-nostrtools`
- `@nostrwatch/publisher-nostrtools`

## Local commands

```bash
pnpm changeset              # Add a changeset
pnpm version-packages       # Apply version bumps locally
pnpm release                # Version bump + commit + push
pnpm release:publish        # Version bump + commit + push + publish to npm
```

## GUI deployment

The GUI (`apps/gui`) is deployed to CDN (Bunny + nsite) on every push to `next`. It is marked `private` and is not published to npm.

## Docker images

Docker images for `relaymon` and `trawler` are built separately via docker compose and are independent of the npm release process.
