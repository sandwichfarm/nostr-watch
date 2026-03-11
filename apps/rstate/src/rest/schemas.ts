/**
 * REST API Response Schemas
 *
 * Loads and provides JSON schemas for response validation
 * Uses lazy loading to avoid errors when schemas directory doesn't exist
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Cache for loaded schemas
const schemaCache = new Map<string, object>()

/**
 * Load a JSON schema from the schemas directory (lazy loaded)
 * Returns empty object if schema file doesn't exist
 */
function loadSchema(filename: string): object {
  // Check cache first
  if (schemaCache.has(filename)) {
    return schemaCache.get(filename)!
  }

  const schemaPath = join(__dirname, '..', 'schemas', filename)

  // Debug logging
  const debug = process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace'
  if (debug) {
    console.log(`[Schema Debug] Loading schema: ${filename}`)
    console.log(`[Schema Debug] __dirname: ${__dirname}`)
    console.log(`[Schema Debug] Resolved path: ${schemaPath}`)
    console.log(`[Schema Debug] File exists: ${existsSync(schemaPath)}`)
  }

  // Check if file exists before trying to read
  if (!existsSync(schemaPath)) {
    console.warn(`Schema file not found: ${schemaPath}, using empty schema`)
    const emptySchema = {}
    schemaCache.set(filename, emptySchema)
    return emptySchema
  }

  try {
    const schemaContent = readFileSync(schemaPath, 'utf-8')
    const schema = JSON.parse(schemaContent)

    if (debug) {
      console.log(`[Schema Debug] Successfully loaded ${filename}, keys:`, Object.keys(schema))
    }

    schemaCache.set(filename, schema)
    return schema
  } catch (err) {
    console.error(`Failed to load schema ${filename}:`, err)
    const emptySchema = {}
    schemaCache.set(filename, emptySchema)
    return emptySchema
  }
}

/**
 * REST API response schemas (lazy loaded via getters)
 */
export const schemas = {
  health: {
    get ping() { return loadSchema('health-ping-output.json') },
  },
  relays: {
    get listSimple() { return loadSchema('relays-list-simple-output.json') },
    get listObject() { return loadSchema('relays-list-object-output.json') },
    get getState() { return loadSchema('relays-get-state-output.json') },
    get availability() { return loadSchema('relays-availability-output.json') },
    get searchSimple() { return loadSchema('relays-search-simple-output.json') },
    get searchObject() { return loadSchema('relays-search-object-output.json') },
    get nearbySimple() { return loadSchema('relays-nearby-simple-output.json') },
    get nearbyObject() { return loadSchema('relays-nearby-object-output.json') },
    get bboxSimple() { return loadSchema('relays-bbox-simple-output.json') },
    get bboxObject() { return loadSchema('relays-bbox-object-output.json') },
    get getLabels() { return loadSchema('relays-get-labels-output.json') },
    get listLabels() { return loadSchema('relays-list-labels-output.json') },
    get byLabelSimple() { return loadSchema('relays-by-label-simple-output.json') },
    get byLabelObject() { return loadSchema('relays-by-label-object-output.json') },
    get bySoftware() { return loadSchema('relays-by-software-output.json') },
    get byNetwork() { return loadSchema('relays-by-network-output.json') },
    get byNip() { return loadSchema('relays-by-nip-output.json') },
    get byCountry() { return loadSchema('relays-by-country-output.json') },
    get compare() { return loadSchema('relays-compare-output.json') },
  },
  monitors: {
    get get() { return loadSchema('monitors-get-output.json') },
    get list() { return loadSchema('monitors-list-output.json') },
    get analytics() { return loadSchema('monitors-analytics-output.json') },
    get analyticsList() { return loadSchema('monitors-analytics-list-output.json') },
  },
  policy: {
    get get() { return loadSchema('policy-get-output.json') },
    get set() { return loadSchema('policy-set-output.json') },
  },
  // subscriptions: disabled — dead code, kept for later
  // subscriptions: {
  //   get subscribe() { return loadSchema('relays-subscribe-state-output.json') },
  //   get unsubscribe() { return loadSchema('relays-unsubscribe-output.json') },
  // },
}
