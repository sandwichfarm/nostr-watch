# Phase 1: Foundation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The README styleguide exists, is machine-enforced in CI, and the VitePress configuration aggregates all package docs into a working unified site structure — making it safe to write any package README. This phase delivers the standards and tooling; actual package READMEs are written in Phases 2–4.

</domain>

<decisions>
## Implementation Decisions

### Styleguide section order
- Standard open-source order: Header/badges → Overview → Prerequisites → Install → Quick Start → API → Config → Known Limitations → Agent Skills → Related Packages → License
- Every package README must follow this order; styleguide defines each section's purpose and content expectations

### Badge standards
- Full badge set on every README: npm version, license, status (alpha/beta/stable), runtime support (web/node/deno/cli)
- Badge format standardized in styleguide with shield.io URLs or equivalent

### Code example format
- Realistic minimal examples using actual package exports
- Match codebase style: no semicolons, single quotes, ESM imports (`import { X } from '@nostrwatch/package'`)
- Use real relay URLs (e.g., `wss://relay.damus.io`) in examples
- Fenced code blocks with `ts` or `js` language tags

### Tone and audience
- Newcomer-friendly: explain Nostr concepts briefly, link to relevant NIP specs
- Define terms when first used (relay, NIP, adapter, etc.)
- Don't assume prior Nostr ecosystem knowledge, but do assume TypeScript/npm/pnpm familiarity

### VitePress navigation
- Sidebar organized by type: Apps / Libraries / Internal — matches monorepo directory structure
- Within each group, packages listed alphabetically
- Top-level pages: Architecture overview, Getting Started (dev environment setup, running tests, common workflows)

### Package discovery index
- Card grid layout: each package shown as a visual card with icon/emoji, name, one-line description, status badge
- Cards link to the package's README page in the docs site

### VitePress theming
- Default VitePress theme with nostr-watch brand colors (primary color customization only)
- No custom layout or homepage hero — keep it standard and maintainable

### markdownlint configuration
- Moderate strictness: enforce heading order, no duplicate headings, consistent list markers, fenced code blocks with language tags
- Disable noisy rules: MD013 (line length), MD034 (bare URLs)
- Custom rule or config to validate required sections exist in correct order (if feasible)

### CI enforcement behavior
- GitHub Actions workflow: markdownlint-cli2 + lychee
- PRs: required checks (must pass to merge)
- Push to main: run but only warn (don't block hotfixes)
- `pnpm lint:docs` script in root package.json runs markdownlint-cli2 locally — same command CI uses

### Link checking scope
- lychee checks both internal links (cross-package references) and external links (npm, NIP specs, GitHub)
- Exclusion list for known-flaky domains: relay URLs that may be offline, badge service URLs that rate-limit
- Internal link validation catches broken cross-references between package READMEs

### Deprecation format
- Prominent blockquote warning banner at the very top of the README: `> ⚠️ **DEPRECATED** — This package has been replaced by [X]. See [link].`
- Minimal stub below: why deprecated, where to go, no full API docs
- Deprecated packages in VitePress: listed in discovery index but visually dimmed with "deprecated" badge and strikethrough styling

### Deprecated packages
- `apps/nocapd` — deprecated, replaced by relaymon
- `internal/nwcache` — deprecated
- `libraries/schemata` — moved to `@nostrability/schemata`, gets a redirect stub

### Known Limitations sections
- Bulleted list format: each limitation describes what it is, why it matters, and any workaround or planned fix
- Link to CONCERNS.md entry or relevant GitHub issue when available
- Honest but constructive tone — acknowledge tech debt without being alarming

### Claude's Discretion
- Exact markdownlint rule IDs to enable/disable beyond the ones specified
- VitePress config details (rewrites, search plugin choice, sidebar generation approach)
- Architecture overview page content and structure
- Getting Started page content and structure
- lychee exclusion list specifics
- Icon/emoji choices for package cards in discovery index

</decisions>

<specifics>
## Specific Ideas

- Root README already has a package table with type, description, status, runtime columns — card grid index should capture the same info in a more visual format
- Existing auditor README is a decent example of realistic code examples — that style should be the baseline
- The `> alpha af` line in auditor README shows the informal current style — styleguide should set a more professional but still approachable tone
- `docs/gui/` already exists and may have some VitePress config to build on

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/gui/scripts/deploy-bunny.mjs`: Bunny CDN deployment script (Phase 6 will reuse, but good to know the pattern exists)
- `.prettierrc.yaml`: Existing code formatter config — documentation should match its style conventions (no semicolons, single quotes)
- `.eslintrc.yml`: Existing linter config — docs CI workflow follows same pattern
- Root `package.json`: Workspace scripts pattern — `pnpm lint:docs` follows existing conventions

### Established Patterns
- pnpm workspace with `pnpm-workspace.yaml` defining all package paths
- GitHub Actions CI already exists with 4 workflows — docs workflow follows the same structure
- `@nostrwatch/*` scoped package naming — used in import examples
- Changesets for package publishing (`.changeset/` directory) — docs build can hook into same pipeline

### Integration Points
- `.github/workflows/` — new docs workflow lives alongside existing CI workflows
- `docs/` directory — VitePress config and build output
- Root `package.json` — `lint:docs` and `docs:dev`/`docs:build` scripts
- Each package's `README.md` — will be consumed by VitePress rewrites

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-04*
