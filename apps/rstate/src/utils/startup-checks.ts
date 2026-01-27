/**
 * Startup Checks
 *
 * Verifies presence of critical runtime assets (e.g., JSON schemas) and logs
 * crisp, actionable errors without throwing. Keeps server resilient in dev and prod.
 */

import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getLogger } from './logger.js'

const logger = getLogger().child({ module: 'startup-checks' })

/**
 * Resolve the schemas directory relative to this compiled file location.
 * - In dev (tsx/ts-node): __dirname ≈ src/utils → ../schemas → src/schemas
 * - In prod (built): __dirname ≈ dist/utils → ../schemas → dist/schemas
 */
function resolveSchemasDir(): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  return join(__dirname, '..', 'schemas')
}

/**
 * Verify presence of critical schema files used by subscriptions and REST.
 * Logs clear errors if missing, with the resolved directory path.
 */
export function verifyCriticalSchemas(): void {
  try {
    const dir = resolveSchemasDir()
    const required = [
      'relays-subscribe-state-output.json',
      'relays-unsubscribe-output.json',
    ]

    for (const name of required) {
      const p = join(dir, name)
      if (!existsSync(p)) {
        logger.error({ path: p, dir }, `Missing JSON schema: ${name}.`)
        logger.error('Build step should copy src/schemas → dist/schemas. Ensure tsup ran successfully.')
      }
    }
  } catch (err) {
    logger.error({ err }, 'Schema verification encountered an unexpected error')
  }
}

