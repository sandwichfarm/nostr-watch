# Phase 2: Internal Package READMEs - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Write conforming README.md for all 9 internal/ packages following the Phase 1 styleguide. Each README must pass markdownlint-cli2 CI checks and render correctly in the VitePress site. This phase covers internal packages only — library and app READMEs are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Content depth
- API sections: document key exports only (3-5 most important per package), link to source for the rest
- Internal packages have lighter documentation requirements per the styleguide Package Type Matrix
- Packages with rich exports (utils ~15 modules, publisher with adapter pattern) get more thorough API coverage
- Packages with minimal exports get proportionally shorter API sections

### Deprecation and minimal package handling
- `nwcache` gets a deprecation stub per the styleguide (explicitly noted as deprecated, no replacement — functionality was inlined)
- `kinds` and `redis` — if source directory is empty or has no meaningful exports, write a minimal README (overview + installation + license) rather than a deprecation stub, since they're still workspace packages
- All other packages (utils, logger, publisher, announce, controlflow, seed) get full READMEs with all required sections

### Known Limitations sourcing
- Surface limitations already documented in `.planning/codebase/CONCERNS.md` first
- Light audit of each package source for TODOs, @ts-nocheck, console.log patterns — document notable findings
- For packages with no CONCERNS.md entries and no source issues: "No known limitations at this time."
- publisher has a known concern (unfinished language tag validation in Kind30166.ts) — must appear in its Known Limitations

### Code examples
- Quick Start examples should reflect real usage patterns from the monorepo — pull actual import patterns from consuming packages
- Show how the package is really used (e.g., how relaymon uses logger, how publisher is used in announce)
- Follow styleguide code conventions: no semicolons, single quotes, ESM imports, TypeScript preferred
- Use real relay URLs where relevant (wss://relay.damus.io, wss://nos.lol)

### Claude's Discretion
- Exact section length and detail per package — scale to complexity
- Whether to include Optional sections (Quick Start, Configuration) for simpler packages
- How to handle packages without package.json description (kinds, redis, nwcache) — infer from source
- Ordering of packages within plan waves — group by complexity or dependency

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/styleguide/README.md`: Authoritative guide with section order, badge reference, code example guidelines, tone guide, Known Limitations template, deprecation stub template, and Package Type Matrix
- `.markdownlint-cli2.jsonc`: Enforces section order via MD043 rule — READMEs must comply
- `.planning/codebase/CONCERNS.md`: Source for Known Limitations sections (publisher language tag validation, console.log in announce/publisher)

### Established Patterns
- Internal packages use scope badge (not npm badge): `[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)]`
- Installation shows workspace dependency: `pnpm add @nostrwatch/pkg --filter @nostrwatch/your-package`
- Cross-package imports use `@nostrwatch/{package-name}` via pnpm workspace
- Pino-based logging pattern in logger: `getLogger().child({ module: 'name' })`
- Adapter pattern in publisher: base publisher + adapters/NostrTools/

### Integration Points
- Each README renders as a VitePress route at `/internal/{package-name}/`
- VitePress data loader (`docs/.vitepress/packages.data.ts`) reads package.json for metadata
- Sidebar in `docs/.vitepress/config.ts` lists all 38 packages grouped by type
- Related Packages sections should cross-link between internal packages and their library/app consumers

</code_context>

<specifics>
## Specific Ideas

- nwcache deprecation stub should note "functionality was inlined" with no replacement package to link to
- publisher README should document the adapter pattern clearly since it's a key architectural concept used across the monorepo
- utils README should organize its many modules (keys, array, env, signing, browser, class, etc.) into logical subsections
- logger README should show the child context pattern since it's used throughout the entire codebase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-internal-package-readmes*
*Context gathered: 2026-03-04*
