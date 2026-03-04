# Coding Conventions

**Analysis Date:** 2026-03-04

## Naming Patterns

**Files:**
- `PascalCase.ts` for class files: `Base.ts`, `ConfigValidator.ts`, `TimeoutHelper.ts`
- `camelCase.ts` for utility and helper files: `utils.ts`, `string.ts`, `array.ts`, `nostr.ts`
- `.test.ts` suffix for test files co-located with source: `string.test.ts`, `array.test.ts`, `ClientHandler.test.ts`

**Functions:**
- camelCase for function names: `capitalize()`, `truncate()`, `shuffleArray()`, `generateSubId()`
- snake_case with underscore prefix for internal/private methods: `_check()`, `_on()`, `can_check()`, `maybe_timeout()`
- snake_case for handler methods: `handle_error()`, `handle_connect_check()`, `handle_read_check()`, `on_change()`, `on_error()`, `on_closed()`
- PascalCase for async class methods that return promises: `addDeferred()`, `useAdapter()`

**Variables:**
- camelCase for standard variables: `currentCheck`, `sessionId`, `websocketKey`
- lowercase with underscores for constants and configuration: `hard_fail`, `cb` (callback object)
- UPPERCASE_SNAKE_CASE for static constants: `SAMPLE_EVENT`

**Types:**
- PascalCase with I-prefix for interfaces: `IConfig`, `IResult`, `IAdapter`, `IResultData`, `IEveryAdapterDefault`
- PascalCase for types: `CheckKey`, `PreCheckKey`, `CheckMethodKey`, `StrictCheckKey`
- Generic types use standard TypeScript conventions: `Record<string, any>`, `Promise<any>`

## Code Style

**Formatting:**
- Prettier configuration (`.prettierrc.yaml`):
  - No semicolons: `semi: false`
  - Single quotes: `singleQuote: true`
  - No trailing commas: `trailingComma: none`
  - Print width: 80 characters
  - No tabs: `useTabs: false`
  - Bracket spacing: `bracketSpacing: false`
  - Arrow parens avoided: `arrowParens: avoid`

**Linting:**
- ESLint configuration (`.eslintrc.yml`):
  - Browser and ES2021 environments enabled
  - Extends: `eslint:recommended`
  - No specific rules overridden (using defaults)

## Import Organization

**Order:**
1. External dependencies: `import WebSocket from 'ws'`
2. Scoped packages: `import Logger from "@nostrwatch/logger"`
3. Path imports with utilities: `import { capitalize, parseRelayNetwork } from "@nostrwatch/utils"`
4. Relative imports (validators, classes, interfaces): `import { ConfigValidator } from "../validators/ConfigValidator"`
5. Local class/type imports: `import { SessionHelper } from "./SessionHelper"`
6. Constant/data imports: `import SAMPLE_EVENT from "../data/sample_event"`

**Path Aliases:**
- `@nostrwatch/*` used extensively for scoped package imports across monorepo
- Relative paths with `../` for same-package imports
- Example: `import Logger from "@nostrwatch/logger"` instead of relative path

## Error Handling

**Patterns:**
- `.catch()` chains for promise error handling: `await this.start(key).catch((err) => this.logger.debug(err))`
- `try/catch` blocks for synchronous operations
- Custom error creation with descriptive messages: `throw new Error('Key must be string')`
- Error objects passed through to promise rejection: `reject({ status: "error", message, data })`
- Validation before execution to prevent runtime errors
- Error logging via `this.logger.debug()` or `this.logger.error()`
- Promise rejection with structured error data containing `status`, `message`, and contextual data

**Error Classes:**
- Standard `Error` objects used throughout
- Extended error objects with status field: `{ status: "error", message: string, data?: any }`

## Logging

**Framework:** Custom Logger class from `@nostrwatch/logger`

**Patterns:**
- Instantiate logger with context: `new Logger('@nostrwatch/nocap: ${this.url}', this?.config?.logLevel)`
- Debug messages for flow tracking: `this.logger.debug('methodName(): message')`
- Include context in log messages: `${key}: check(): resolved`
- Warn level for non-critical issues: `this.logger.warn('Cannot check SSL from browser')`
- Error level for exceptions: `this.logger.error('on_limits(): ${e}')`
- Log conditional states: `${key}: prechecker(): needs websocket: ${needsWebsocket}`

## Comments

**When to Comment:**
- JSDoc/TSDoc for public methods and class properties
- Inline comments for complex logic or non-obvious decisions
- Section comments with blank lines for major method groups

**JSDoc/TSDoc:**
- Method documentation format:
  ```typescript
  /**
   * methodName
   * Brief description
   *
   * @public/@private
   * @async (if applicable)
   * @param {type} name - Description
   * @returns {type} - Description
   */
  ```
- Example from codebase:
  ```typescript
  /**
   * check
   * Public method for dataprep and routing a check request
   *
   * @public
   * @async
   * @param keys - The keys to check
   * @param headers - Whether to include headers in result (default: true)
   * @returns {Promise<*>} - The result of the checks
   */
  async check(keys: CheckKey | CheckKey[], headers = true): Promise<any>
  ```
- Block comments for sections: `/*instances*/`, `/*results*/`, `/*checks*/`

## Function Design

**Size:** Methods range widely but average 20-50 lines. Complex orchestration methods like `check()` exceed 100 lines.

**Parameters:**
- Typed parameters with explicit types: `key: CheckKey`, `key: StrictCheckKey`
- Union types for flexible inputs: `keys: CheckKey | CheckKey[] | string`
- Optional parameters with defaults: `maxLength: number = 64`
- This context preserved through method chaining: `on(method: string, fn: Function): Base`

**Return Values:**
- Explicit return types: `boolean`, `Promise<any>`, `Promise<never>`
- Async functions return Promises: `async check(...): Promise<any>`
- Method chaining via `return this`: `on(method: string, fn: Function): Base { ... return this }`
- Mixed returns from promises and direct values where needed

## Module Design

**Exports:**
- Default export for main class: `export default class Base { ... }`
- Named exports for utilities: `export function capitalize(text: string): string`
- Barrel exports in index files:
  ```typescript
  export * from "./classes"
  export type * from "./interfaces"
  export type * from "./types"
  ```
- Scoped package exports with @ prefix: `@nostrwatch/nocap`, `@nostrwatch/logger`

**Barrel Files:**
- Pattern: `src/index.ts` aggregates all exports
- Example from `libraries/nocap/src/index.ts`:
  ```typescript
  export * from "./classes"
  export type * from "./interfaces"
  export * from "./validators"
  export { Nocap }
  export default Nocap
  ```

**Internal Pattern:**
- Helper/utility files export individual functions
- Classes exported as defaults and via named exports
- Types kept separate with `type` keyword: `export type * from "./types"`

---

*Convention analysis: 2026-03-04*
