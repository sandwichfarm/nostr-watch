# Pitfalls Research

**Domain:** Monorepo developer documentation — TypeScript/Nostr brownfield codebase
**Researched:** 2026-03-04
**Confidence:** HIGH (critical pitfalls verified via official docs + multiple sources; moderate pitfalls MEDIUM)

---

## Critical Pitfalls

### Pitfall 1: Styleguide Without Enforcement Means No Styleguide

**What goes wrong:**
A README styleguide is written, documented, and then completely ignored in practice. Package after package deviates — some use different section order, some have no "Agent Skills" section, some have code blocks with missing language tags. After 30+ packages are written you have the same inconsistency you started with, just with a style document nobody checks.

**Why it happens:**
There is no friction-free enforcement loop. Reviewers eyeball README quality in PRs but have no checklist. Authors follow the styleguide from memory and forget sections. The styleguide itself may be ambiguous (e.g., "overview paragraph" — how long?). This is especially acute in brownfield work where "reformat existing stub" feels like a lower bar than writing from scratch.

**How to avoid:**
1. Validate the styleguide against a validation script from day one. A simple bash/Node script that checks that every README has the required section headings in order is sufficient.
2. Add the validation script to CI so a README that's missing a `## Agent Skills` section or has incorrect section order fails the build.
3. Write the styleguide in terms of machine-checkable predicates, not human prose ("The README MUST contain a `## Agent Skills` heading" not "include agent skills where relevant").

**Warning signs:**
- First 3–4 packages written without the validator running
- Styleguide sections described in vague language ("a brief overview")
- No CI step checking README format

**Phase to address:**
Styleguide phase — the validator must be built and passing before any package READMEs are written.

---

### Pitfall 2: Docs Written For the Moment, Stale Within a Week

**What goes wrong:**
READMEs accurately describe the codebase on the day they're written. Then code changes: a new config key, a renamed class, an added adapter hook. The README still says the old thing. Developers start ignoring READMEs because "they're probably wrong." AI agents use the stale docs and make wrong decisions. The longer the project runs, the more drift accumulates.

**Why it happens:**
Documentation is written as a one-shot deliverable ("document everything") instead of as a living artifact ("maintain documentation alongside code"). There is no ownership model — who is responsible for updating `libraries/nocap/README.md` when the nocap API changes? There is no CI signal that docs are stale.

**How to avoid:**
1. For anything that references a concrete API, configuration key, or file path — link to source, not copy it. Example: instead of listing all config keys, link to `src/config.ts` and describe the shape.
2. Use `markdownlint` + Vale in CI to enforce link validity (no dead internal links).
3. Add a CHANGELOG hook: before merging any PR that modifies `src/` in a package, CI warns if the package README has not been touched. This is not a hard block, but it creates the friction point.
4. Avoid embedding version numbers or internal implementation details in READMEs. Focus on stable interface contracts.

**Warning signs:**
- READMEs that duplicate the type signature of exported functions verbatim
- READMEs with hardcoded version numbers (e.g., "requires Node 22.15.0")
- No CI link-check step

**Phase to address:**
Styleguide phase (establish what NOT to document), then CI/deployment phase (add link and staleness checks).

---

### Pitfall 3: mkdocs Navigation That Requires Manual Updates Per Package

**What goes wrong:**
The root `mkdocs.yml` nav is written by hand with 30+ `!include` entries. Every time a new package is added or a package gets a new `docs/` subdirectory, the nav must be manually updated. It doesn't happen. The site goes out of sync with the repository. Packages that exist don't appear in the nav; packages that were removed leave broken links.

**Why it happens:**
The `mkdocs-monorepo-plugin` requires navigation to be statically declared. The default instinct is to write the nav once and forget it. In a monorepo with 30+ packages this becomes a maintenance burden immediately.

**How to avoid:**
Use the glob-based `*include` syntax (available since `mkdocs-monorepo-plugin` v0.5.2) to auto-discover per-package `mkdocs.yml` files rather than listing them explicitly. Pair with `mkdocs-awesome-pages-plugin` for file-level ordering without a hand-written nav. The result: adding a new package with a `mkdocs.yml` and `.pages` file automatically wires it into the site without touching root config.

Example root nav pattern:
```yaml
nav:
  - Home: index.md
  - Apps: '*include apps/*/mkdocs.yml'
  - Libraries: '*include libraries/*/mkdocs.yml'
  - Internal: '*include internal/*/mkdocs.yml'
```

**Warning signs:**
- Root `mkdocs.yml` nav lists packages by name explicitly (30+ lines)
- Nav is written before all packages have been documented
- No validation that nav entries match actual files

**Phase to address:**
mkdocs configuration phase — establish glob-based nav pattern before documenting any packages.

---

### Pitfall 4: Claude Code Skills With Vague Descriptions That Never Trigger

**What goes wrong:**
Skills are written with descriptions like "Helps with relay adapters" or "Use for nocap operations." When a developer or agent asks "how do I add a new nocap adapter?" Claude doesn't select the skill because the description doesn't match the query's vocabulary. The skills exist but are functionally invisible — they never trigger.

**Why it happens:**
Skill descriptions are written by the person who knows the codebase deeply, using domain-internal vocabulary. The trigger vocabulary of the person asking ("I want to add a new backend for relay checking") doesn't match the description vocabulary ("nocap adapter creation").

The official Anthropic docs are explicit: "The description is critical for skill selection: Claude uses it to choose the right Skill from potentially 100+ available Skills." (HIGH confidence — verified against official Skills best practices documentation.)

**How to avoid:**
1. Write descriptions in third person, with both what the skill does AND explicit trigger phrases: "Guides adapter creation for the `@nostrwatch/nocap` relay checking framework. Use when adding a new transport, creating a nocap plugin, implementing a custom check, or extending relay capability detection."
2. Include common user vocabulary alternatives in the description — "transport", "plugin", "backend", "integration."
3. Test each skill by asking 5 different phrasings of the task it addresses and verifying the skill triggers. This is the evaluation-driven approach from Anthropic's own best practices.

**Warning signs:**
- Skill descriptions under 50 characters
- Descriptions using internal-only names without explanation ("Use for nocap adapter tasks")
- No evaluation tests written for skills

**Phase to address:**
Skills authoring phase — validate trigger vocabulary before shipping each skill.

---

### Pitfall 5: Over-Documenting Internals, Under-Documenting Integration Points

**What goes wrong:**
Internal packages like `@nostrwatch/logger`, `@nostrwatch/utils`, and `@nostrwatch/kinds` get long READMEs explaining every exported function — most of which are never called directly by consuming code. Meanwhile, the integration story ("how does `@nostrwatch/trawler` use `@nostrwatch/nocap`, and what does a developer need to configure to add a new source?") is missing.

The result: developers and agents can answer trivia about individual functions but cannot answer the high-value question of "how does this fit together?"

**Why it happens:**
Writing a README for each package independently — the natural approach for 30 packages — produces package-local docs. The cross-cutting integration story requires a different lens. In this codebase, the adapter pattern (nocap, publisher, route66) is the primary integration surface, but it lives across multiple packages.

**How to avoid:**
1. For internal packages, prioritize the "when would you touch this?" question over API exhaustiveness. Most internal utilities don't need a full API reference — they need a one-liner and a note about which apps consume them.
2. Create explicit integration guides at the monorepo level (not per package): "Adding a nocap adapter," "Creating a publisher extension," "Extending route66 with a new aggregation strategy." These span package boundaries and are the highest-value docs.
3. Scope the skills to integration tasks, not package-level operations.

**Warning signs:**
- All 30+ packages get equal-depth READMEs regardless of consumer surface
- No cross-package "how to" guides
- Skills are named after packages rather than tasks ("nocap" vs "adding-a-relay-check-adapter")

**Phase to address:**
Styleguide phase (establish depth tiers), Skills phase (scope to integration tasks).

---

### Pitfall 6: Context File (CLAUDE.md) Divergence Between Root and Per-Package

**What goes wrong:**
A root `CLAUDE.md` is written for the monorepo. Individual packages get their own CLAUDE.md or skill files. Over time, the root `CLAUDE.md` gets updated but the per-package files don't, or vice versa. Conventions stated in one place contradict conventions in another. Agents following the per-package context get different behavior from agents using the root context. One analysis found 178 lines of difference between two context files in a project that intended them to be consistent. (MEDIUM confidence — from community case study, not official documentation.)

**How to avoid:**
1. Treat the root `CLAUDE.md` as the canonical source of cross-cutting conventions (build commands, code style, commit format). Never duplicate these in per-package CLAUDE.md files — reference back to root instead.
2. Per-package CLAUDE.md files (if used) should contain only package-specific overrides: "This package uses Deno, not Node" not "Use prettier for formatting."
3. Skills are the correct scope for package-specific guidance, not per-package CLAUDE.md files.

**Warning signs:**
- Same convention stated in both root CLAUDE.md and package-level docs
- "Convention X" stated differently in root vs package
- Per-package CLAUDE.md files that are longer than 50 lines

**Phase to address:**
Skills architecture design phase — establish the CLAUDE.md / Skills boundary before writing either.

---

## Moderate Pitfalls

### Pitfall 7: mkdocs Build Succeeds Locally, Breaks on Deploy Due to Asset Paths

**What goes wrong:**
README files reference local assets (`![](.assets/output.png)` is already present in `libraries/auditor/README.md`). When mkdocs builds the unified site, relative paths that worked when viewing the file locally in GitHub no longer resolve because the build process relocates files.

**How to avoid:**
- Audit all existing READMEs for relative image paths and local asset references before migrating them to the mkdocs build.
- Establish a convention: images referenced in READMEs go in the package's `docs/assets/` directory (mkdocs-managed), not `.assets/` (git-only).
- Add a broken-image check to the mkdocs build step.

**Phase to address:**
mkdocs configuration phase — establish asset conventions before migrating existing content.

---

### Pitfall 8: Bunny CDN Cache Serving Stale Docs After Deploy

**What goes wrong:**
A docs update is deployed. The Bunny CDN pull zone still serves the old content for minutes or hours because the cache was not purged. The deploy "worked" but users see old docs. This is especially invisible — no build failure, no error, just wrong content silently.

**How to avoid:**
1. The existing `apps/gui/scripts/deploy-bunny.mjs` pattern can be adapted, but it must include an explicit cache-purge API call after upload.
2. Bunny CDN lacks an API to confirm geo-replication is complete. A 15-second wait before purge is recommended practice (confirmed via Bunny deployment community guides, MEDIUM confidence).
3. Add a post-deploy smoke test: fetch the `index.html` from the CDN and verify a known string from the latest build appears before declaring the deploy successful.

**Phase to address:**
Deployment pipeline phase.

---

### Pitfall 9: Skill Files That Are Too Long and Kill Context Efficiency

**What goes wrong:**
Skills for complex operations (like the NIP-66 protocol guidance or the adapter creation workflows) balloon to 500+ lines trying to be comprehensive. Every agent session that loads the skill pays the full token cost even when only a tiny part of the skill is relevant.

**How to avoid:**
The official Anthropic guidance is explicit: keep `SKILL.md` body under 500 lines; split content into separate reference files using progressive disclosure — SKILL.md points to `reference/` files that are only loaded when needed. (HIGH confidence — from official Anthropic Skills authoring documentation.)

For this project's most complex skills (NIP-66 guidance, nocap adapter creation, route66 extension), the correct structure is:
```
skills/nip66-guidance/
  SKILL.md              # <100 lines, overview + links
  reference/nip66.md    # Protocol details
  reference/event-kinds.md
  examples/kind30166.md
```

**Phase to address:**
Skills authoring phase — review all draft skills for length before shipping.

---

### Pitfall 10: Nested !include in mkdocs-monorepo-plugin Breaks the Build

**What goes wrong:**
A sub-package's `mkdocs.yml` attempts to use `!include` to pull in its own nested docs directory. The build fails because the `mkdocs-monorepo-plugin` only supports `!include` in the root `mkdocs.yml`, not in included sub-files. This is a documented design decision, not a bug.

**How to avoid:**
Each package's `mkdocs.yml` (included by the root) must be self-contained — it can list its own nav but cannot itself use `!include` to reference deeper levels.

**Warning signs:**
- Any per-package `mkdocs.yml` that contains `!include`
- Package documentation that has a "docs/api/" subdirectory referenced via include

**Phase to address:**
mkdocs configuration phase — document this constraint in the mkdocs setup guide.

---

### Pitfall 11: Documenting the Brownfield "As-Intended" Rather Than "As-Is"

**What goes wrong:**
The codebase has known tech debt (SDK stubs with `@ts-nocheck`, hardcoded filter limits, incomplete validation). When writing docs for the brownfield code, there is a temptation to document the intended/aspirational behavior rather than the actual behavior. Agents following the documentation then produce code that assumes the ideal state and fails at runtime.

**Why it is especially acute here:**
`.planning/codebase/CONCERNS.md` documents 10+ known bugs, tech debt items, and fragile areas. `apps/rstate/src/sdk-stubs.ts` contains mock signatures deployed as real. If a skill says "use `publisher.sign()` to sign events" without noting that it uses a mock signer in the current codebase, an agent will assume real cryptographic signing is occurring.

**How to avoid:**
1. For packages with known concerns, the README should have a "Known Limitations" section that links to or summarizes the relevant items from `CONCERNS.md`.
2. Skills for fragile areas (relay URL validation, monitor filter management, SDK stubs) should include an explicit caveat before any code examples.
3. Do not suppress warnings or known issues to make the docs look clean.

**Phase to address:**
Per-package README phase — cross-reference against `CONCERNS.md` for each package.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy-paste type signatures into README | Fast, looks complete | Stale immediately when types change; creates a second source of truth | Never — link to source instead |
| Write root `mkdocs.yml` nav by hand | Simple initial setup | Must be manually maintained as packages grow | Never — use glob includes from the start |
| Single monolithic CLAUDE.md for everything | One file to rule them all | Context bloat; agents load irrelevant context every session; scale breaks at ~1000 lines | Never for a 30+ package monorepo |
| Document all packages at the same depth | Consistent feel | Wastes effort on 1-function internal utils; hides complexity of public-facing packages | Never — tier depth by consumer surface |
| Write skills after all READMEs are done | READMEs can inform skills | Skills and READMEs need consistent vocabulary; doing them in sequence creates rework | Acceptable only for first 2–3 pilot packages |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Bunny CDN deploy | Upload files, declare success | Upload files, wait 15s, purge pull zone cache, run smoke test on CDN URL |
| mkdocs monorepo plugin | Write one root nav.yml listing all packages | Use `*include apps/*/mkdocs.yml` glob; add `mkdocs-awesome-pages-plugin` for ordering |
| Claude Code Skills | Trust skill triggers implicitly | Write 3+ evaluation tests per skill; test that it triggers for common phrasings |
| GitHub Actions CI | Only lint/test code | Add `markdownlint`, Vale, and link-checker steps; README format check step |
| mkdocs + relative assets | Reference `.assets/` as in existing auditor README | Move all image assets to `docs/assets/` per mkdocs conventions before building |

---

## "Looks Done But Isn't" Checklist

- [ ] **README styleguide:** "We have a styleguide doc" — verify there is also a CI validator that enforces it on every PR
- [ ] **Skills written:** "All skills are in `.claude/skills/`" — verify each skill has been tested with 3+ trigger phrasings and a non-obvious failure case
- [ ] **mkdocs build passes:** "The build succeeds locally" — verify it passes in CI with all packages included, and asset paths resolve correctly in the built HTML
- [ ] **Bunny CDN deploy works:** "Files uploaded successfully" — verify CDN is serving the new content (not cached old content) at `developers.nostr.watch`
- [ ] **Brownfield concerns surfaced:** "Package X is documented" — verify that packages with entries in `CONCERNS.md` have a "Known Limitations" section in their README
- [ ] **Nested skills don't cause drift:** "Skills reference the codebase correctly" — verify that any function, config key, or file path named in a skill still exists in the codebase

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 30 READMEs already written without styleguide enforcement | HIGH | Build validator; audit each README against it; fix failures systematically; treat as a rewrite phase |
| mkdocs nav hand-written for 30 packages, then packages reorganized | MEDIUM | Switch to glob `*include` pattern; delete hand-written nav entries; add per-package mkdocs.yml files |
| Skills never trigger because descriptions are vague | LOW | Rewrite description fields only (YAML frontmatter); no content changes needed; re-test trigger vocabulary |
| CDN serving stale docs | LOW | Manually trigger Bunny cache purge via API or dashboard; add purge step to deploy script going forward |
| CLAUDE.md / Skills contradiction | MEDIUM | Audit all context files for duplicated conventions; consolidate to root CLAUDE.md + skills; delete duplicates |
| Docs describe aspirational API, not actual brownfield behavior | HIGH | Cross-reference CONCERNS.md against all READMEs; add Known Limitations sections; update skills with caveats |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| No styleguide enforcement | Styleguide phase (Phase 1) | CI step must fail on a README missing a required section |
| Docs go stale immediately | Styleguide phase (link policy) + CI/Deploy phase | Link checker runs on every PR; no absolute version numbers in READMEs |
| Manual mkdocs nav | mkdocs config phase (before any package docs) | `mkdocs build` passes without any hand-written package nav entries in root |
| Skills never trigger | Skills authoring phase | Each skill has an eval file; trigger tested with 3+ phrasings before merge |
| Over-documentation of internals | Styleguide phase (depth tiers) | Tier classification recorded per package; internal utils cap at 200 lines |
| CLAUDE.md / per-package divergence | Architecture design phase (before writing either) | Root CLAUDE.md conventions are not duplicated anywhere else |
| Asset path breakage in mkdocs | mkdocs config phase | `mkdocs build` produces zero missing-image warnings |
| Bunny CDN cache not purged | Deployment pipeline phase | Deploy script explicitly calls purge API; smoke test verifies CDN content |
| Skill files too long | Skills authoring phase | CI check: no SKILL.md body exceeds 500 lines |
| Nested `!include` in monorepo plugin | mkdocs config phase | Doc convention: per-package mkdocs.yml files must not contain `!include` |
| Brownfield documented as aspirational | Per-package README phase | Each package checked against CONCERNS.md before its README is merged |

---

## Sources

- Anthropic official Skills authoring best practices — [platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (HIGH confidence)
- mkdocs-monorepo-plugin limitations — [backstage.github.io/mkdocs-monorepo-plugin/limitations/](https://backstage.github.io/mkdocs-monorepo-plugin/limitations/) (HIGH confidence — official plugin docs)
- mkdocs-monorepo-plugin GitHub issues (navigation, nested includes) — [github.com/backstage/mkdocs-monorepo-plugin/issues](https://github.com/backstage/mkdocs-monorepo-plugin/issues) (HIGH confidence — issue tracker)
- Material for MkDocs large navigation performance discussion — [github.com/squidfunk/mkdocs-material/issues/1887](https://github.com/squidfunk/mkdocs-material/issues/1887) (MEDIUM confidence)
- Bunny CDN static site deployment guide including replication delay issue — [european-alternatives.eu/blog/how-to-host-a-static-site-on-bunny-net-cdn-with-automatic-deployment](https://european-alternatives.eu/blog/how-to-host-a-static-site-on-bunny-net-cdn-with-automatic-deployment) (MEDIUM confidence)
- AI coding agent context file maintenance challenges — [packmind.com/evaluate-context-ai-coding-agent/](https://packmind.com/evaluate-context-ai-coding-agent/) (MEDIUM confidence — community case study)
- Docs linting CI integration — [buildwithfern.com/post/docs-linting-guide](https://buildwithfern.com/post/docs-linting-guide) (MEDIUM confidence)
- Codified context / single-file manifest scaling limits — [arxiv.org/html/2602.20478v1](https://arxiv.org/html/2602.20478v1) (MEDIUM confidence — academic, 2026)
- Existing nostr-watch codebase concerns — `.planning/codebase/CONCERNS.md` (HIGH confidence — first-party analysis)
- Existing nostr-watch README samples (`apps/gui/README.md`, `libraries/auditor/README.md`) (HIGH confidence — direct observation)

---

*Pitfalls research for: TypeScript monorepo developer documentation (nostr-watch)*
*Researched: 2026-03-04*
