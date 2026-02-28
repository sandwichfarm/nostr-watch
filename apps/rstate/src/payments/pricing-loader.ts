/**
 * Unified Pricing Loader
 *
 * Reads the shared pricing.yaml and optional per-transport override files.
 * Both CVM and REST loaders consume this.
 */

import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'pricing-loader' })

export interface PricingEntry {
  name: string
  amount: number
  currencyUnit: string
  description: string
}

interface PricingFile {
  endpoints: PricingEntry[]
}

function loadYaml(path: string): PricingFile {
  const raw = readFileSync(path, 'utf8')
  const parsed = parseYaml(raw)
  if (!parsed?.endpoints || !Array.isArray(parsed.endpoints)) {
    throw new Error(`Pricing file ${path}: expected "endpoints" array`)
  }
  return parsed as PricingFile
}

/**
 * Load unified pricing with optional overrides merged on top.
 *
 * @param basePath   - Path to pricing.yaml (env: PRICING_YAML)
 * @param overridePath - Optional path to transport-specific overrides
 * @returns Merged pricing entries (overrides replace base entries by name)
 */
export function loadPricing(basePath: string, overridePath?: string): PricingEntry[] {
  const base = loadYaml(basePath)
  const entries = new Map<string, PricingEntry>()

  for (const e of base.endpoints) {
    entries.set(e.name, e)
  }

  if (overridePath) {
    try {
      const overrides = loadYaml(overridePath)
      for (const e of overrides.endpoints) {
        entries.set(e.name, { ...entries.get(e.name), ...e })
      }
      logger.info({ overridePath, count: overrides.endpoints.length }, 'Pricing overrides applied')
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        logger.debug({ overridePath }, 'No override file found, using base pricing only')
      } else {
        throw err
      }
    }
  }

  return Array.from(entries.values())
}
