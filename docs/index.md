---
layout: doc
---

# nostr-watch Documentation

Developer documentation for the @nostrwatch monorepo — a suite of tools for monitoring, validating, and exploring the Nostr relay network.

## Quick Links

- [Architecture Overview](/architecture) — How the monorepo is structured and how packages relate
- [Getting Started](/getting-started) — Set up your dev environment and common workflows
- [All Packages](/packages/) — Browse all 30+ packages by type

## What is nostr-watch?

nostr-watch is a collection of tools for the Nostr ecosystem focused on relay monitoring and analysis. It includes:

- **Apps** — Production services like the web dashboard (gui), relay state machine (rstate), data crawler (trawler), and health monitor (relaymon)
- **Libraries** — Reusable packages for relay capability discovery (nocap), aggregation (route66), event validation (auditor), and more
- **Internal** — Shared infrastructure including logging, caching, event publishing, and utilities
