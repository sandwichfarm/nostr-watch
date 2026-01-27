# @nostrwatch/gui

Client-side SvelteKit interface for nostr.watch, focused on browsing, testing, and researching Nostr relays via the nostr.watch NIP-66 monitor network. SSR is disabled and the app builds to a static bundle.

## Installation
- Requirements: Node 20+ (Volta pins 22.15.0) and pnpm 8+ (the repo enforces pnpm via `only-allow`).
- Clone the monorepo and install from the root so workspace dependencies such as `@nostrwatch/route66`, `@nostrwatch/nocap`, and the worker packages are linked correctly:
  ```bash
  git clone https://github.com/sandwichfarm/nostr-watch.git
  cd nostr-watch
  pnpm install
  ```
  Optional: `pnpm dev:setup` will link local workspace builds the way the author develops.

## Usage
- Start the dev server (Vite/SvelteKit, HMR, port 5173 by default):
  ```bash
  pnpm --filter @nostrwatch/gui dev
  ```
- Production build (uses `vite.production.js`, outputs to `apps/gui/dist`):
  ```bash
  pnpm --filter @nostrwatch/gui build
  ```
- Preview the built bundle:
  ```bash
  pnpm --filter @nostrwatch/gui preview
  ```
- Checks and tooling:
  ```bash
  pnpm --filter @nostrwatch/gui test     # vitest
  pnpm --filter @nostrwatch/gui check    # svelte-check
  pnpm --filter @nostrwatch/gui lint     # prettier --check
  pnpm --filter @nostrwatch/gui format   # prettier --write
  ```

## Features
- Relay catalog with fast filtering, saved table preferences, and map support powered by the monitor network’s aggregated checks.
- Relay detail pages built from configurable cards (general info, fees, operator, insights, checks, RTT, uptime, issues, similar relays).
- Monitor management to enable/disable monitors and spot coverage gaps or bandwidth-heavy setups.
- Operator view summarizing relay operators and their published metadata.
- NIP-66 event viewer (`/note/[id]`) that decodes NIP-19 identifiers or raw ids and shows the originating monitor and related relay data.
- Desktop-first experience; mobile devices are intentionally shown an unsupported notice.

## Project Layout
- `src/routes` — SvelteKit routes for the landing page, relay catalog and detail pages, monitors, operators, note viewer, preferences, and the mobile/unsupported fallbacks.
- `src/lib/components` — UI pieces such as data tables/views, cards, layout, dialogs, and partials used across pages.
- `src/lib/stores` — App state derived from the nostr.watch worker stack (`@nostrwatch/route66`, cache adapters, monitors, checks, relay metadata).
- `src/lib/utils` — Lifecycle helpers, routing helpers, and bootstrap logic for wiring the Route66 instance and data register.
- `service-workers` and `static` — Static assets; service workers are explicitly unregistered on insecure contexts.
- `svelte.config.js`, `vite.config.ts`, `vite.production.js`, `tailwind.config.ts` — Build, prerender, and styling configuration (static adapter with prerendered entries, COOP/COEP headers in dev).

## Development Notes
- The app is client-only (`ssr = false`) and uses the static adapter with a prerender list; runtime data is fetched from monitors and caches via WebSocket/IndexedDB.
- Workspace packages are required; running commands from within `apps/gui` without the monorepo context will miss the internal dependencies.
- Use the Preferences page to wipe local cache/state if relay data appears stale; warnings on the Monitors page call out under- or over-provisioned monitor counts.

## License
MIT, see `LICENSE`.
