# Phase 4: App Package READMEs - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Write conforming README.md or deprecation stubs for all 8 apps/ packages following the Phase 1 styleguide. Apps emphasize Prerequisites (env vars, runtime deps), Quick Start (how to run), and Configuration. Deprecated apps (nocapd, possibly umon) get deprecation stubs. This phase covers apps only.

</domain>

<decisions>
## Implementation Decisions

### Content depth
- Apps get FULL documentation per styleguide Package Type Matrix — emphasis on Prerequisites and Configuration
- Environment variables documented in tables with Required/Description/Example columns
- Quick Start shows how to run the app locally end-to-end
- API section only if app exposes REST API or SDK (rstate has REST API)

### Deprecation handling
- nocapd gets deprecation stub pointing to relaymon (explicitly noted in styleguide)
- umon needs assessment during research — if experimental/inactive, deprecation stub; if active, full README
- docker-stacks needs assessment — may need different treatment since it's infra, not a runnable app

### Known Limitations sourcing
- Same approach as Phases 2-3: CONCERNS.md first, then light source audit
- CONCERNS.md has entries for: rstate (outdated dev utilities, SDK stubs, mock signer, console.log in scoring), gui (table config separation, worker fallback, store race conditions), relaymon (relay URL filtering bug, incomplete DB inspection)
- These MUST appear in respective READMEs

### Code examples
- Same conventions: TypeScript, no semicolons, single quotes, ESM imports
- For apps: show shell commands to start (`pnpm dev`, `pnpm start`, etc.)
- Environment variable examples use realistic placeholder values
- Deno apps (trawler) use Deno-specific commands

### Claude's Discretion
- How to handle docker-stacks (it's Docker Compose definitions, not a typical app)
- Exact section depth per app — scale to complexity
- Whether umon gets full README or deprecation stub (assess during research)
- How to document rstate's REST API (inline table vs dedicated subsection)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/styleguide/README.md`: App-specific guidance in Package Type Matrix and Prerequisites example
- `.planning/codebase/CONCERNS.md`: Rich source for Known Limitations (rstate, gui, relaymon all have entries)
- `.planning/codebase/STRUCTURE.md`: Entry points, config files, tech stack per app documented
- Phase 2-3 READMEs: Established patterns for all section types

### Established Patterns
- Apps use npm badge: `[![npm version](https://img.shields.io/npm/v/@nostrwatch/pkg)]`
- Installation for apps: `pnpm install` in the app directory
- Prerequisites section critical for apps — env vars, databases, runtime requirements
- Related Packages sections cross-link to libraries and internal packages used

### Integration Points
- Each README renders as VitePress route at `/apps/{package-name}/`
- VitePress sidebar lists all apps grouped under Apps section
- CONCERNS.md entries for rstate, gui, relaymon must appear in Known Limitations
- nocapd deprecation stub links to relaymon (already documented in styleguide example)

### App Inventory
- gui: SvelteKit dashboard (most complex frontend)
- rstate: ContextVM relay state machine + REST API (most complex backend)
- trawler: Deno-based relay crawler
- relaymon: Node.js relay health monitor
- purist: Data transformation utilities
- nocapd: DEPRECATED → relaymon
- docker-stacks: Docker Compose definitions
- umon: Experimental monitoring (needs assessment)

</code_context>

<specifics>
## Specific Ideas

- rstate README should document REST API endpoints since it exposes a Fastify server
- gui README should cover the development workflow (SvelteKit dev server, environment setup)
- trawler README should note Deno runtime requirement prominently in Prerequisites
- nocapd deprecation stub can follow the exact template from styleguide (already has a concrete example)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-app-package-readmes*
*Context gathered: 2026-03-05*
