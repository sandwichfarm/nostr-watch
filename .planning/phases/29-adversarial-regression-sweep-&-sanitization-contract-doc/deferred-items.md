# Phase 29 Deferred Items

## Pre-existing Playwright spec failures (out of scope)

**Files:**
- `apps/gui/tests/relay-detail-debug.spec.ts`
- `apps/gui/tests/relay-detail.spec.ts`

**Symptom:** Vitest runs these Playwright specs (because they end in `.spec.ts`) and fails on `test.describe()` because Playwright Test refuses to be invoked from vitest's transform pipeline.

**Why deferred:** Pre-existing infrastructure issue, not caused by Phase 29's changes. Both files predate v2.5 (last touched in commit 05638ea9). The Playwright/Vitest conflict is unrelated to the v2.5 GUI XSS Hardening milestone scope.

**Vitest unit-test pass count:** 274 / 274 (Phases 24-28 cases + Phase 29's 21 new cases all green).

**Suggested fix (future):** Add a `vitest.config.ts` `exclude` entry for `tests/**/*.spec.ts` so vitest skips Playwright e2e specs. Alternatively, rename the files to `*.e2e.spec.ts` and pattern-exclude. Out of scope for Phase 29.
