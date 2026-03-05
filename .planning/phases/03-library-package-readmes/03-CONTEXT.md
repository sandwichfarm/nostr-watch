# Phase 3: Library Package READMEs - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Write conforming README.md for all 17 libraries/ packages following the Phase 1 styleguide. Adapter-bearing libraries (nocap, route66, kit) require extra depth — an agent should be able to create a new adapter without reading source code. This phase covers libraries only — app READMEs are Phase 4.

Note: The roadmap lists 17 requirements (LIB-01 through LIB-17) but there are 21 library directories on disk. Some directories (kit, nocap-route66, sanitize, transform) are not in the requirements — they may need READMEs or deprecation stubs depending on their status.

</domain>

<decisions>
## Implementation Decisions

### Content depth
- Libraries get FULL documentation per styleguide Package Type Matrix — API section is Required
- Adapter-bearing libraries (nocap, route66, kit) need dedicated "Adapter Pattern" subsection explaining: interface to implement, registration mechanism, existing adapters as examples
- nocap README is a success criterion: developer must understand adapters without reading source
- nip66 README is a success criterion: must explain protocol event kinds and data model for NIP-66 newcomers

### Adapter documentation pattern
- For each adapter-bearing library: document the adapter interface, show how to create a new adapter, list existing adapters with one-line descriptions
- Follow the pattern established in Phase 2's publisher README (adapter pattern documentation)
- Link to actual adapter source directories as reference implementations

### Known Limitations sourcing
- Same approach as Phase 2: CONCERNS.md first, then light source audit
- CONCERNS.md has entries for: route66 (hardcoded filter limits, default relay config, incomplete RTT extraction), auditor (incomplete filter range testing)
- These MUST appear in respective READMEs

### Unlisted library directories
- kit, nocap-route66, sanitize, transform — need assessment during research
- If deprecated or empty: deprecation stubs
- If active but unlisted in requirements: write full READMEs anyway (better to document than skip)

### Code examples
- Same conventions as Phase 2: TypeScript, no semicolons, single quotes, ESM imports
- Use real relay URLs (wss://relay.damus.io, wss://nos.lol)
- Libraries are published to npm — Installation section shows `pnpm add @nostrwatch/pkg` (not workspace install)
- Quick Start must produce visible output or meaningful side effect

### Claude's Discretion
- How to group the 17+ libraries across plan waves — balance by complexity
- Whether to split nocap and route66 into dedicated plans (roadmap suggests yes)
- Section depth per library — scale to API surface area
- How to handle the 4 unlisted directories (assess during research)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/styleguide/README.md`: Full library documentation requirements in Package Type Matrix
- `.markdownlint-cli2.jsonc`: MD043 section order enforcement
- `.planning/codebase/CONCERNS.md`: Known Limitations source for route66, auditor
- Phase 2 READMEs (internal/*): Established patterns for adapter docs (publisher), Known Limitations format

### Established Patterns
- Libraries use npm badge (not scope badge): `[![npm version](https://img.shields.io/npm/v/@nostrwatch/pkg)]`
- Installation shows `pnpm add @nostrwatch/pkg` + npm alternative
- Adapter pattern: base class + adapters/{AdapterName}/src/index.ts
- nocap adapters: DNS, Info, SSL, WebSocket, Geo (5 types)
- route66 adapters: separate adapter packages
- kit adapters: separate adapter packages

### Integration Points
- Each README renders as VitePress route at `/libraries/{package-name}/`
- VitePress sidebar lists all libraries grouped under Libraries section
- Related Packages sections should cross-link between libraries and their internal/app consumers
- Fix seed README's broken link to libraries/db during this phase

</code_context>

<specifics>
## Specific Ideas

- nocap README should be the gold standard for adapter documentation — it's explicitly called out in success criteria
- nip66 README needs protocol-level explanation since NIP-66 is domain-specific knowledge
- schemata + schemata-js-ajv are tightly coupled — Related Packages should cross-link heavily
- relay-charts depends on relay-chronicle — document the relationship clearly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-library-package-readmes*
*Context gathered: 2026-03-04*
