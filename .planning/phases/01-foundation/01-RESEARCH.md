# Phase 1: Foundation - Research

**Researched:** 2026-03-04
**Domain:** Documentation toolchain: markdownlint-cli2, lychee, VitePress, GitHub Actions CI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Styleguide section order:** Header/badges -> Overview -> Prerequisites -> Install -> Quick Start -> API -> Config -> Known Limitations -> Agent Skills -> Related Packages -> License
- **Badge standards:** Full badge set — npm version, license, status (alpha/beta/stable), runtime support (web/node/deno/cli); shield.io URLs
- **Code example format:** No semicolons, single quotes, ESM imports (`import { X } from '@nostrwatch/package'`); real relay URLs; fenced `ts`/`js` blocks; realistic minimal examples
- **Tone:** Newcomer-friendly, define Nostr terms on first use, assume TypeScript/npm/pnpm familiarity
- **VitePress navigation:** Sidebar by type — Apps / Libraries / Internal; alphabetical within groups; top-level: Architecture overview, Getting Started
- **Package discovery index:** Card grid layout with icon/emoji, name, one-line description, status badge; cards link to package README page
- **VitePress theming:** Default VitePress theme, primary brand color only — no custom layout or homepage hero
- **markdownlint config:** Moderate strictness; enforce heading order/no duplicate headings/consistent list markers/fenced code blocks with language tags; disable MD013, MD034; custom rule/config to validate required sections in order (if feasible)
- **CI enforcement:** markdownlint-cli2 + lychee in GitHub Actions; PRs = required checks; push to main = warn only; `pnpm lint:docs` in root package.json runs same command as CI
- **Link checking scope:** lychee checks both internal and external links; exclusion list for known-flaky domains (relay URLs, badge services); validates cross-package internal refs
- **Deprecation format:** Prominent blockquote at very top: `> ⚠️ **DEPRECATED** — ...`; minimal stub below; VitePress index shows dimmed with "deprecated" badge + strikethrough
- **Deprecated packages:** `apps/nocapd`, `internal/nwcache`, `libraries/schemata` (redirect stub to `@nostrability/schemata`)
- **Known Limitations sections:** Bulleted list; each item: what it is, why it matters, workaround or planned fix; link to CONCERNS.md entry or GitHub issue when available

### Claude's Discretion

- Exact markdownlint rule IDs to enable/disable beyond specified ones
- VitePress config details (rewrites, search plugin choice, sidebar generation approach)
- Architecture overview page content and structure
- Getting Started page content and structure
- lychee exclusion list specifics
- Icon/emoji choices for package cards in discovery index

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | README styleguide defines consistent section order (header, badges, overview, prerequisites, install, usage, API, config, agent skills, related packages, contributing, license) | MD043 can enforce section presence/order; styleguide is a Markdown doc authored manually |
| FOUND-02 | README styleguide defines badge standards (build status, version, license, runtime support) | Styleguide authored content; shields.io badge URL format is standard |
| FOUND-03 | README styleguide defines code example format (language tags, import style, realistic minimal examples) | Styleguide authored content; markdownlint MD040 enforces fenced blocks have language tags |
| FOUND-04 | README styleguide defines tone/voice guide (audience assumptions, level of explanation, writing style) | Styleguide authored content; no tooling enforcement |
| FOUND-05 | CI enforcement validates README format via markdownlint-cli2 in GitHub Actions | markdownlint-cli2 v0.21.0 installed; DavidAnson/markdownlint-cli2-action@v22 for Actions; MD043 for section order |
| FOUND-06 | CI enforcement validates links via lychee link checker in GitHub Actions | lycheeverse/lychee-action@v2; .lycheeignore for exclusions; cache to mitigate rate-limiting |
| FOUND-07 | VitePress configuration aggregates all package docs into unified site with search and navigation | VitePress rewrites with dynamic params map `libraries/:pkg/README.md` -> `:pkg/index.md`; sidebar as object with path prefixes |
| FOUND-08 | Package discovery index page lists all 30+ packages with type, status, one-line description, and link | Custom Vue component registered globally in `.vitepress/theme/index.ts`; data sourced from package.json files |
| LIMIT-01 | Each README surfaces relevant issues from CONCERNS.md in a "Known Limitations" section | Styleguide section definition; CONCERNS.md must exist or be created as part of styleguide |
| LIMIT-02 | Deprecated packages have prominent deprecation notice with link to replacement | Styleguide defines deprecation stub format; three known deprecated packages to stub out |
</phase_requirements>

## Summary

Phase 1 delivers the scaffold everything else builds on: a README styleguide document, machine enforcement of that styleguide via markdownlint-cli2 in CI, link validation via lychee in CI, and a VitePress site that aggregates all package READMEs into a unified browsable structure. The phase produces no package README content — it only creates the standards and structure that make safe content authoring possible in Phases 2–4.

The toolchain is already partially installed: markdownlint-cli2 v0.21.0 is present at the project root (confirmed via `npx markdownlint-cli2 --version`). No VitePress config exists yet — `docs/` only contains a `gui/` subdirectory with planning documents. No `.markdownlint-cli2.yaml` exists at the project root. No lychee binary is installed locally (only used in CI).

The most technically nuanced decisions are: (1) whether to use MD043 directly or write a custom markdownlint rule for section-order enforcement — MD043 supports the use case well enough to avoid a custom rule; (2) how VitePress rewrites handle relative image paths like `libraries/auditor/.assets/output.png` — this needs early validation since a rewrite that moves a file's URL also moves its relative asset base; (3) how to generate the card grid discovery index — a small Vue component fed by a build-time data loader is the cleanest pattern.

**Primary recommendation:** Use MD043 for section-order enforcement (built-in, no custom rule needed), use VitePress dynamic rewrites for path mapping, and implement the card grid as a global Vue component with a build-time data loader that reads package.json files across the monorepo.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| markdownlint-cli2 | 0.21.0 (installed) | README format linting CLI | Installed; config-file-first design; supports custom rules; same library used by markdownlint-cli2-action |
| markdownlint | 0.40.0 (bundled) | Core lint engine | Bundled with cli2; MD043 built-in handles required-sections enforcement |
| VitePress | 1.6.x (to install) | Static docs site generator | Chosen in STATE.md; Vue 3, Vite, TypeScript; rewrites for monorepo; active maintenance |
| lycheeverse/lychee-action | v2 | Link checking in CI | Official action; supports .lycheeignore; rate-limit caching |
| DavidAnson/markdownlint-cli2-action | v22 | markdownlint in CI | Official action; direct CLI parity; accepts globs and config path |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitepress-sidebar | latest | Auto-generate sidebar from filesystem | Consider if sidebar complexity grows; currently manual sidebar is tractable for ~3 groups |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MD043 for section order | Custom markdownlint rule | Custom rule offers richer error messages but MD043 with wildcards covers the use case — prefer built-in |
| Manual sidebar config | vitepress-sidebar plugin | Plugin adds a dependency; manual config is transparent and directly expresses the Apps/Libraries/Internal grouping |
| lychee-action | broken-link-checker npm | lychee is Rust-native, faster, handles internal + external; chosen in decisions |

**Installation:**

```bash
# Install VitePress and configure docs build
pnpm add -D vitepress --filter @nostrwatch/monorepo

# markdownlint-cli2 already present; verify:
npx markdownlint-cli2 --version
# Expected: markdownlint-cli2 v0.21.0

# lychee is CI-only: no local install needed
# The lychee-action downloads the binary in CI
```

## Architecture Patterns

### Recommended Project Structure

```
docs/                          # VitePress root
├── .vitepress/
│   ├── config.ts              # VitePress config: rewrites, sidebar, nav, themeConfig
│   └── theme/
│       ├── index.ts           # Register custom components + import custom.css
│       ├── custom.css         # Brand color overrides (--vp-c-brand-1 only)
│       └── components/
│           └── PackageIndex.vue   # Card grid for discovery index
├── index.md                   # Docs home page (layout: doc, not home)
├── packages/                  # Discovery index
│   └── index.md               # <!--@include--> or PackageIndex component
├── architecture.md            # Architecture overview
└── getting-started.md         # Dev env setup, running tests, common workflows

# Package READMEs are consumed via VitePress rewrites — they do NOT live in docs/
# Each package's README.md is rewritten into the docs URL space:
#   libraries/auditor/README.md  ->  /libraries/auditor/
#   apps/gui/README.md           ->  /apps/gui/
#   internal/utils/README.md     ->  /internal/utils/
```

### Pattern 1: VitePress Rewrites for Monorepo READMEs

**What:** VitePress `rewrites` config maps source files outside `docs/` into the docs URL namespace. Package READMEs stay in their package directories; VitePress renders them at clean URLs.

**When to use:** Any monorepo where package documentation lives alongside package source code.

**Example:**

```typescript
// docs/.vitepress/config.ts
// Source: https://vitepress.dev/guide/routing
export default defineConfig({
  srcDir: '.',           // srcDir = repo root, not docs/
  rewrites: {
    // Dynamic param pattern — one rule covers all packages per category
    'libraries/:pkg/README.md': 'libraries/:pkg/index.md',
    'apps/:pkg/README.md': 'apps/:pkg/index.md',
    'internal/:pkg/README.md': 'internal/:pkg/index.md',
    // Docs pages themselves are already in docs/
    'docs/:slug*': ':slug*',
  }
})
```

**Critical note:** Setting `srcDir: '.'` means VitePress treats the repo root as its content root. All markdown under `docs/` appears at root URLs. All package READMEs appear at their rewritten paths. The `outDir` should be explicitly set to `docs/.vitepress/dist` to keep build output inside `docs/`.

### Pattern 2: MD043 for Required Section Enforcement

**What:** markdownlint's built-in MD043 rule checks that a file's headings match a configured array in order. The `"*"` wildcard allows "zero or more unspecified headings" between required ones.

**When to use:** Enforce that every package README contains the required sections in the correct order.

**Example:**

```jsonc
// .markdownlint-cli2.jsonc (repo root)
{
  "config": {
    "default": true,
    "MD013": false,   // line length — too noisy
    "MD034": false,   // bare URLs — too noisy, we use badge URLs
    "MD043": {
      // "*" = zero or more optional headings allowed between required ones
      // Match headings by text, not level — MD043 matches heading text only
      "headings": [
        "*",              // H1 package title (any text)
        "## Overview",
        "*",              // optional sections (Prerequisites etc.)
        "## Installation",
        "*",
        "## Quick Start",
        "*",
        "## Known Limitations",
        "*",
        "## License"
      ],
      "match_case": false
    },
    "MD040": true,    // fenced code blocks must have language tag
    "MD001": true,    // heading levels increment by one
    "MD022": true,    // headings surrounded by blank lines
    "MD024": { "siblings_only": true }  // no duplicate headings (siblings only)
  },
  "globs": ["**/*.md"],
  "ignores": [
    "node_modules/**",
    "docs/**",          // docs/ pages are not package READMEs
    ".planning/**",
    "CHANGELOG.md",
    "**/CHANGELOG.md"
  ]
}
```

**MD043 limitation:** MD043 validates that the headings present match the pattern array in sequence. It does NOT flag extra headings that appear in the *wrong* position — it only ensures the required headings appear in the right relative order. The wildcard `"*"` absorbs optional sections. This is sufficient for the use case.

### Pattern 3: Card Grid Discovery Index

**What:** A Vue component registered globally in `.vitepress/theme/index.ts` renders a card grid. Data is loaded at build time from a data loader that reads `package.json` across the monorepo.

**When to use:** Package discovery index page (FOUND-08).

**Example (data loader — docs/.vitepress/packages.data.ts):**

```typescript
// Source: VitePress data loaders — https://vitepress.dev/guide/data-loading
import { createContentLoader } from 'vitepress'
import { glob } from 'glob'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Alternative: read package.json files directly at build time
export default {
  async load() {
    const manifests = glob.sync('{apps,libraries,internal}/*/package.json', {
      cwd: resolve(__dirname, '../..'),
      ignore: ['**/node_modules/**']
    })
    return manifests.map(p => {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, '../..', p), 'utf-8'))
      return {
        name: pkg.name,
        description: pkg.description ?? '',
        version: pkg.version ?? '',
        status: pkg.nostrwatch?.status ?? 'alpha',
        type: p.split('/')[0],   // apps | libraries | internal
        deprecated: pkg.nostrwatch?.deprecated ?? false,
        link: `/${p.replace('/package.json', '/')}`,
      }
    })
  }
}
```

**Example (component — docs/.vitepress/theme/components/PackageIndex.vue):**

```vue
<script setup lang="ts">
import { data as packages } from '../packages.data.ts'
const props = defineProps<{ type?: string }>()
const filtered = props.type ? packages.filter(p => p.type === props.type) : packages
</script>

<template>
  <div class="package-grid">
    <a v-for="pkg in filtered" :key="pkg.name" :href="pkg.link"
       :class="['package-card', { deprecated: pkg.deprecated }]">
      <span class="status-badge">{{ pkg.status }}</span>
      <h3>{{ pkg.name }}</h3>
      <p>{{ pkg.description }}</p>
    </a>
  </div>
</template>
```

### Pattern 4: lychee GitHub Actions Workflow

**What:** Two distinct lychee jobs — one for PRs (required check), one for push to main (warn-only).

**Example:**

```yaml
# .github/workflows/docs-lint.yml (excerpt)
- name: Check links
  uses: lycheeverse/lychee-action@v2
  with:
    args: >-
      --cache
      --max-cache-age 1d
      --exclude-mail
      --root-dir ${{ github.workspace }}
      'README.md'
      '**/*.md'
    format: markdown
    output: ./lychee/results.md
    fail: ${{ github.event_name == 'pull_request' }}
    token: ${{ secrets.GITHUB_TOKEN }}
```

```
# .lycheeignore (repo root)
# Relay URLs — may be offline
^wss://
# Badge services — rate-limit frequently
^https://img\.shields\.io
^https://badge\.fury\.io
# npm — sometimes flaky
^https://www\.npmjs\.com/package/
```

### Anti-Patterns to Avoid

- **Setting `srcDir` without `outDir`:** VitePress defaults `outDir` to `.vitepress/dist` relative to `srcDir`. With `srcDir: '.'`, this places build output at the repo root `.vitepress/dist`. Always set `outDir: 'docs/.vitepress/dist'` explicitly.
- **Forgetting to ignore `**/CHANGELOG.md` in markdownlint:** Changelogs have non-conforming heading structures. Must be in ignores list.
- **Using MD043 without wildcards:** Without `"*"` entries, MD043 requires exact heading sequence with no extras. Use wildcards liberally so optional sections (Agent Skills, Related Packages, etc.) don't cause false failures.
- **Relative image paths break with rewrites:** `libraries/auditor/README.md` uses `.assets/output.png`. After rewriting to `/libraries/auditor/index.md`, the relative path resolves against the new URL, not the source file location. VitePress copies public assets from the `srcDir` — verify that `.assets/` directories are recognized or move images to a `public/` folder.
- **lychee checking relay wss:// links:** Relay URLs appear in code examples and will time out or fail. Add `^wss://` to `.lycheeignore`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section order validation | Custom regex or AST walker | MD043 built-in rule | MD043 handles edge cases (heading levels, whitespace); already installed |
| Link checking | Custom script fetching URLs | lychee | Rate limiting, redirect handling, anchor verification, parallel requests — lychee handles all of this |
| Sidebar generation | Script to glob filesystem | Manual sidebar config (for now) | Only 3 groups, ~30 items; manual is explicit and readable; add vitepress-sidebar only if it becomes a burden |
| Package metadata aggregation | Shell scripts or CI-time generation | VitePress data loaders | Data loaders run at build time, are type-safe, integrate with VitePress's reactive build |

**Key insight:** The built-in MD043 rule is sufficient for required-section enforcement. Custom rules add implementation and maintenance cost for minimal gain at this stage.

## Common Pitfalls

### Pitfall 1: VitePress Relative Asset Paths Break After Rewrites

**What goes wrong:** `libraries/auditor/README.md` contains `![](.assets/output.png)`. After rewriting to `/libraries/auditor/index.md`, the relative path resolves to `/libraries/auditor/.assets/output.png`. This works only if VitePress's asset pipeline can find `.assets/` — which it will if `srcDir: '.'` and the directory exists under the source root.

**Why it happens:** VitePress rewrites change the URL, not the file location. Relative paths in content resolve against the rewritten URL base.

**How to avoid:** Test with `libraries/auditor/README.md` in the initial VitePress setup. Confirm `.assets/output.png` renders in the dev server. If not, move assets to `docs/public/` with package-namespaced paths.

**Warning signs:** 404s in VitePress dev server for images; broken image boxes in browser.

### Pitfall 2: MD043 Strict Mode Breaks Optional Sections

**What goes wrong:** MD043 is configured with the required section list but without `"*"` wildcards. Any README that includes a section not in the pattern (e.g., "## Contributing" or "## Agent Skills") fails the check.

**Why it happens:** Without wildcards, MD043 requires exact heading sequence with no unlisted headings.

**How to avoid:** Use `"*"` liberally between required headings to allow optional sections. The pattern should only enforce that required sections appear in the right relative order, not that no other sections exist.

**Warning signs:** All READMEs fail lint on sections that are optional per the styleguide.

### Pitfall 3: lychee Rate-Limiting Kills CI

**What goes wrong:** lychee checks external URLs including shields.io, npmjs.com, and GitHub raw content. These services rate-limit aggressively, causing CI failures on valid links.

**Why it happens:** CI runners share IP ranges; multiple simultaneous checks hit rate limits.

**How to avoid:** Use `--cache` + `--max-cache-age 1d`; add known-flaky domains to `.lycheeignore`; use a GitHub token for GitHub URLs (`--github-token`).

**Warning signs:** CI passes locally, fails in Actions; 429 errors in lychee output.

### Pitfall 4: markdownlint Running Against node_modules

**What goes wrong:** Without explicit ignores, markdownlint-cli2 lints markdown files inside `node_modules/`, producing thousands of errors.

**Why it happens:** `**/*.md` glob matches node_modules unless excluded.

**How to avoid:** Always include `node_modules/**` in `.markdownlint-cli2.jsonc` ignores. Also ignore `**/CHANGELOG.md`, `.planning/**`, and `docs/.vitepress/**`.

### Pitfall 5: `srcDir: '.'` Causes VitePress to Index All Markdown

**What goes wrong:** With `srcDir: '.'`, VitePress discovers and processes ALL markdown files under the repo root — including `.planning/`, `scripts/`, and other non-doc content — unless explicitly excluded.

**Why it happens:** VitePress's content discovery follows `srcDir` without filtering.

**How to avoid:** Use VitePress's `exclude` config option to exclude non-doc directories. Alternatively, set `srcDir: 'docs'` and rely solely on rewrites for package READMEs — this keeps VitePress's scan limited to `docs/` only.

**Recommendation:** Use `srcDir: 'docs'` (not repo root) with explicit rewrites pointing at `../libraries/:pkg/README.md`. This is cleaner isolation.

## Code Examples

Verified patterns from official sources:

### VitePress config with monorepo rewrites

```typescript
// docs/.vitepress/config.ts
// Source: https://vitepress.dev/guide/routing
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'nostr-watch',
  description: 'Documentation for the @nostrwatch monorepo',
  srcDir: 'docs',

  rewrites: {
    // Maps ../libraries/nocap/README.md -> /libraries/nocap/
    // NOTE: rewrites are relative to srcDir, so use relative paths from docs/
    // VitePress resolves these against srcDir
    '../libraries/:pkg/README.md': 'libraries/:pkg/index.md',
    '../apps/:pkg/README.md': 'apps/:pkg/index.md',
    '../internal/:pkg/README.md': 'internal/:pkg/index.md',
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Packages', link: '/packages/' },
    ],
    sidebar: {
      '/apps/': [
        {
          text: 'Apps',
          items: [
            { text: 'gui', link: '/apps/gui/' },
            { text: 'relaymon', link: '/apps/relaymon/' },
            // ... alphabetical
          ]
        }
      ],
      '/libraries/': [
        {
          text: 'Libraries',
          items: [
            { text: 'auditor', link: '/libraries/auditor/' },
            { text: 'nocap', link: '/libraries/nocap/' },
            // ... alphabetical
          ]
        }
      ],
      '/internal/': [
        {
          text: 'Internal',
          items: [
            { text: 'logger', link: '/internal/logger/' },
            { text: 'utils', link: '/internal/utils/' },
            // ... alphabetical
          ]
        }
      ],
    }
  }
})
```

### Brand color customization

```typescript
// docs/.vitepress/theme/index.ts
// Source: https://vitepress.dev/guide/extending-default-theme
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import PackageIndex from './components/PackageIndex.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PackageIndex', PackageIndex)
  }
}
```

```css
/* docs/.vitepress/theme/custom.css */
/* Source: https://vitepress.dev/guide/extending-default-theme */
:root {
  --vp-c-brand-1: #7b5ea7;   /* nostr-watch purple — adjust to actual brand */
  --vp-c-brand-2: #9b7ecb;
}
```

### markdownlint-cli2 config

```jsonc
// .markdownlint-cli2.jsonc (repo root)
{
  "config": {
    "default": true,
    "MD013": false,
    "MD034": false,
    "MD040": true,
    "MD043": {
      "headings": [
        "*",
        "## Overview",
        "*",
        "## Installation",
        "*",
        "## Quick Start",
        "*",
        "## Known Limitations",
        "*",
        "## License"
      ],
      "match_case": false
    }
  },
  "globs": [
    "libraries/*/README.md",
    "apps/*/README.md",
    "internal/*/README.md"
  ],
  "ignores": [
    "node_modules/**",
    "**/CHANGELOG.md"
  ]
}
```

**Key insight:** Scope `globs` to package READMEs only — this avoids linting `.planning/` documents, `docs/` pages, and scripts against the package-README ruleset. Docs pages may have a different (or no) ruleset.

### GitHub Actions docs-lint workflow

```yaml
# .github/workflows/docs-lint.yml
name: Docs Lint

on:
  pull_request:
    paths: ['**/*.md']
  push:
    branches: [main]
    paths: ['**/*.md']

jobs:
  markdownlint:
    name: Markdown Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Lint Markdown
        uses: DavidAnson/markdownlint-cli2-action@v22
        with:
          globs: |
            libraries/*/README.md
            apps/*/README.md
            internal/*/README.md
        continue-on-error: ${{ github.event_name != 'pull_request' }}

  linkcheck:
    name: Link Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Cache lychee
        uses: actions/cache@v4
        with:
          path: .lychee.cache
          key: lychee-${{ hashFiles('**/*.md') }}
          restore-keys: lychee-

      - name: Check links
        uses: lycheeverse/lychee-action@v2
        with:
          args: >-
            --cache
            --max-cache-age 1d
            --github-token ${{ secrets.GITHUB_TOKEN }}
            'libraries/*/README.md'
            'apps/*/README.md'
            'internal/*/README.md'
            'docs/**/*.md'
          format: markdown
          output: ./lychee/results.md
          fail: ${{ github.event_name == 'pull_request' }}
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Root package.json scripts to add

```json
{
  "scripts": {
    "lint:docs": "markdownlint-cli2 'libraries/*/README.md' 'apps/*/README.md' 'internal/*/README.md'",
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| markdownlint-cli (v1) | markdownlint-cli2 | ~2021 | cli2 is config-file-first, faster, actively maintained; cli1 is maintenance mode |
| Manual link checking | lychee (Rust) | ~2022 | 10x faster than Node-based checkers; handles all link types |
| VitePress `srcDir` workarounds | Native `rewrites` config | VitePress 1.0 | Dynamic params `'packages/:pkg/src/:slug*': ':pkg/:slug*'` eliminated per-package config entries |
| X11-based screenshot tools | Irrelevant — docs only | n/a | n/a |

**Deprecated/outdated:**

- markdownlint-cli (v1): still works, but cli2 is the active development path; do not use `markdownlint` CLI, use `markdownlint-cli2`
- VitePress `cleanUrls: true` + manual `pages` config: replaced by `rewrites` for monorepo patterns

## Open Questions

1. **Does `srcDir: 'docs'` with relative `rewrites` paths work correctly?**
   - What we know: VitePress docs show rewrites relative to srcDir; `'../libraries/:pkg/README.md'` should traverse up from `docs/`
   - What's unclear: Whether VitePress actually allows `../` traversal in rewrites or requires `srcDir: '.'`
   - Recommendation: Validate this in Wave 1 with a minimal test using `libraries/auditor/README.md` — if it doesn't work, fall back to `srcDir: '.'` with `exclude` config

2. **CONCERNS.md — does it exist or need to be created?**
   - What we know: LIMIT-01 requires linking to CONCERNS.md entries from Known Limitations sections; STATE.md references it
   - What's unclear: Whether `CONCERNS.md` exists in the repo root already or must be created as part of Phase 1
   - Recommendation: Check in Phase 1 Wave 0; if absent, create a minimal `CONCERNS.md` template as part of the styleguide deliverable

3. **Exact brand color for nostr-watch**
   - What we know: Default VitePress purple is `#646cff`; project has a nostr-watch visual identity
   - What's unclear: Official nostr-watch brand color hex
   - Recommendation: Left to Claude's discretion per CONTEXT.md; use a purple adjacent to nostr's typical purple identity

## Sources

### Primary (HIGH confidence)

- VitePress official docs (https://vitepress.dev/guide/routing) — rewrites, srcDir
- VitePress extending default theme (https://vitepress.dev/guide/extending-default-theme) — CSS variables, component registration
- VitePress sidebar reference (https://vitepress.dev/reference/default-theme-sidebar) — multiple sidebars pattern
- markdownlint MD043 docs (https://github.com/DavidAnson/markdownlint/blob/main/doc/md043.md) — required headings rule
- markdownlint CustomRules docs (https://github.com/DavidAnson/markdownlint/blob/main/doc/CustomRules.md) — custom rule API
- lychee-action README (https://github.com/lycheeverse/lychee-action) — action inputs, .lycheeignore
- markdownlint-cli2 installed locally — confirmed v0.21.0 via `npx markdownlint-cli2 --version`

### Secondary (MEDIUM confidence)

- markdownlint-cli2-action GitHub (https://github.com/DavidAnson/markdownlint-cli2-action) — action version and inputs
- VitePress markdown extensions (https://vitepress.dev/guide/markdown) — file includes, confirmed `<!--@include:-->` syntax
- lychee docs (https://lychee.cli.rs/github_action_recipes/check-repository/) — workflow patterns
- WebSearch: markdownlint-cli2 GitHub Actions examples (multiple sources confirmed action@v22 is current)

### Tertiary (LOW confidence)

- Icon/emoji choices for package cards — Claude discretion, no research needed
- VitePress data loader pattern for package.json reading — inferred from VitePress data loading docs; needs validation against actual build

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — markdownlint-cli2 confirmed installed; VitePress version from STATE.md; lychee-action version from official marketplace
- Architecture: MEDIUM-HIGH — VitePress rewrites pattern verified from official docs; `../` traversal in rewrites unverified
- Pitfalls: HIGH — relative asset path issue is a known VitePress gotcha; MD043 wildcard behavior verified from official docs
- CI workflow: HIGH — workflow structure follows existing project patterns in `.github/workflows/`

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable tools — 30-day window reasonable)
