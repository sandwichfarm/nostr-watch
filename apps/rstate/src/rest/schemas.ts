/**
 * REST API Response Schemas
 *
 * Loads and provides JSON schemas for response validation
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Load a JSON schema from the schemas directory
 */
function loadSchema(filename: string): object {
  const schemaPath = join(__dirname, '..', 'schemas', filename)
  const schemaContent = readFileSync(schemaPath, 'utf-8')
  return JSON.parse(schemaContent)
}

/**
 * REST API response schemas
 */
export const schemas = {
  health: {
    ping: loadSchema('health-ping-output.json'),
  },
  relays: {
    list: loadSchema('relays-list-output.json'),
    getState: loadSchema('relays-get-state-output.json'),
    availability: loadSchema('relays-availability-output.json'),
    nearby: loadSchema('relays-nearby-output.json'),
    bbox: loadSchema('relays-bbox-output.json'),
    getLabels: loadSchema('relays-get-labels-output.json'),
    listLabels: loadSchema('relays-list-labels-output.json'),
    byLabel: loadSchema('relays-by-label-output.json'),
    bySoftware: loadSchema('relays-by-software-output.json'),
    byNetwork: loadSchema('relays-by-network-output.json'),
    byNip: loadSchema('relays-by-nip-output.json'),
    byCountry: loadSchema('relays-by-country-output.json'),
    compare: loadSchema('relays-compare-output.json'),
  },
  monitors: {
    get: loadSchema('monitors-get-output.json'),
    list: loadSchema('monitors-list-output.json'),
    analytics: loadSchema('monitors-analytics-output.json'),
    analyticsList: loadSchema('monitors-analytics-list-output.json'),
  },
  policy: {
    get: loadSchema('policy-get-output.json'),
    set: loadSchema('policy-set-output.json'),
  },
  subscriptions: {
    subscribe: loadSchema('relays-subscribe-state-output.json'),
    unsubscribe: loadSchema('relays-unsubscribe-output.json'),
  },
}
