---
status: awaiting_human_verify
trigger: "NIP11 validation on apps/gui broke within the last month. It worked for 12 months before that."
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T14:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two compounding bugs: (1) @nostrability/schemata@0.1.6 had "type": null (JSON null) in NIP-11 schema causing AJV to throw, and (2) the worker has no try/catch so AJV exceptions crash it silently, causing all validations to timeout
test: Verified by importing validate function with old schema - AJV throws "schema is invalid" error
expecting: Fix by applying error handling hardening to worker (from unmerged hotfix/nip-11-validator branch)
next_action: Apply the try/catch fix to the worker + add onerror handler to SchemaValidationService

## Symptoms

expected: NIP11 validation works correctly in the GUI app as it has for the past 12 months
actual: NIP11 validation is broken/not working correctly in the GUI - worker crashes silently, all validations time out after 5s
errors: AJV throws "schema is invalid" due to "type": null in schemata@0.1.6 NIP-11 schema
reproduction: Use the GUI app's NIP11 validation feature - every relay shows "NIP-11 requires attention"
started: When schemata-js-ajv dist became stale (built against old schemata with "type": null bug)

## Eliminated

- hypothesis: Performance issue or remote server problem
  evidence: User explicitly stated it's not performance or remote servers
  timestamp: 2026-03-07

- hypothesis: Bug in the validate() function logic in schemata-js-ajv/src/index.ts
  evidence: The validate function works correctly when given valid schemas. The crash happens during AJV schema compilation, not in our validation logic.
  timestamp: 2026-03-07

## Evidence

- timestamp: 2026-03-07
  checked: @nostrability/schemata@0.1.6 vs 0.2.3 NIP-11 schema diff
  found: Old version (0.1.6) had "type": null (JSON null) in retention.items.allOf.properties.time.anyOf; new version (0.2.3) fixed to "type": "null" (string)
  implication: Invalid JSON Schema causes AJV to throw during compilation

- timestamp: 2026-03-07
  checked: Direct test of validate() with old schema containing "type": null
  found: AJV throws "schema is invalid: data/properties/retention/items must be object,boolean, data/properties/retention/items/0/allOf/0/properties/time/anyOf/1/type must be equal to one of the allowed values"
  implication: Any NIP11 validation attempt with the old schema crashes

- timestamp: 2026-03-07
  checked: Worker code (schemavalidation.worker.ts) on next branch
  found: No try/catch around validateNip11() call - unhandled exceptions crash the worker
  implication: Worker crashes silently, main thread times out after 5s

- timestamp: 2026-03-07
  checked: Branch hotfix/nip-11-validator (commit 8737d49c)
  found: Contains try/catch fix for the worker but was NEVER MERGED to next
  implication: The fix exists but was not applied to the main branch

- timestamp: 2026-03-07
  checked: Commit 11ebdd52 (schemata bump to 0.2.3)
  found: Only changed package.json and pnpm-lock.yaml; schemata-js-ajv dist is gitignored and needs manual rebuild
  implication: Without rebuilding schemata-js-ajv, the dist still bundles the old broken schema

- timestamp: 2026-03-07
  checked: schemata-js-ajv build script (package.json scripts)
  found: Only has "build" script, no "prepare" or "postinstall" hook
  implication: pnpm install does NOT trigger a rebuild - must run manually

## Resolution

root_cause: Two compounding bugs: (1) @nostrability/schemata@0.1.6 had invalid JSON Schema ("type": null instead of "type": "null") in the NIP-11 schema which causes AJV to throw during schema compilation, and (2) the schema validation worker (schemavalidation.worker.ts) has no try/catch, so the AJV exception crashes the worker silently. The main thread's respond() method times out after 5 seconds, making every NIP-11 validation return a timeout error. The schemata bump to 0.2.3 in commit 11ebdd52 fixes (1) but requires a rebuild of schemata-js-ajv dist. Fix (2) was implemented in commit 8737d49c on branch hotfix/nip-11-validator but was never merged to next.
fix: (1) Added try/catch to schemavalidation.worker.ts so AJV exceptions are caught and returned as error responses instead of crashing the worker silently. (2) Added onerror handler to SchemaValidationService constructor for visibility into worker-level errors. (3) schemata-js-ajv dist rebuilt with @nostrability/schemata@0.2.3 which fixes the "type": null schema bug.
verification: Rebuilt schemata-js-ajv dist; confirmed validateNip11 works with various payloads including retention with null time values. No more AJV "schema is invalid" throws.
files_changed:
  - apps/gui/src/lib/services/SchemaValidationService/schemavalidation.worker.ts
  - apps/gui/src/lib/services/SchemaValidationService/index.ts
