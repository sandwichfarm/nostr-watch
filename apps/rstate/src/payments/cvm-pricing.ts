/**
 * CVM Payment Pricing
 *
 * Loads unified pricing and maps canonical endpoint names to CEP-8
 * PricedCapability format (with `method: 'tools/call'` and CVM tool names).
 */

import type { PricedCapability } from '@contextvm/sdk'
import { loadPricing, type PricingEntry } from './pricing-loader.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'cvm-pricing' })

function toPricedCapability(entry: PricingEntry): PricedCapability {
  return {
    method: 'tools/call',
    name: entry.name,
    amount: entry.amount,
    currencyUnit: entry.currencyUnit,
    description: entry.description,
  }
}

export function loadPricedCapabilities(): PricedCapability[] {
  const basePath = process.env.PRICING_YAML
  if (!basePath) {
    logger.warn('PRICING_YAML not set — CVM payment gating has no priced capabilities')
    return []
  }

  const overridePath = process.env.CVM_PRICING_YAML
  const entries = loadPricing(basePath, overridePath)

  // Only include entries with amount > 0 (free endpoints don't need gating)
  const priced = entries
    .filter(e => e.amount > 0)
    .map(toPricedCapability)

  logger.info({ count: priced.length, override: !!overridePath }, 'CVM priced capabilities loaded')
  return priced
}
