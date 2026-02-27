/**
 * CVM Payment Pricing
 *
 * Defines which MCP tools require payment and their prices (CEP-8).
 * Tools not listed here are free (e.g. relays/list, health/ping, monitors/*).
 */

import type { PricedCapability } from '@contextvm/sdk'

export const pricedCapabilities: PricedCapability[] = [
  { method: 'tools/call', name: 'relays/nearby', amount: 21, currencyUnit: 'sats', description: 'Geo-proximity relay search' },
  { method: 'tools/call', name: 'relays/bbox', amount: 21, currencyUnit: 'sats', description: 'Bounding-box relay search' },
  { method: 'tools/call', name: 'relays/search', amount: 5, currencyUnit: 'sats', description: 'Full-text relay search' },
  { method: 'tools/call', name: 'relays/compare', amount: 15, currencyUnit: 'sats', description: 'Multi-relay comparison' },
]
