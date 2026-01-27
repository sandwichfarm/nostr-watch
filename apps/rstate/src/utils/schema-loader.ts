/**
 * Schema Loader Utility
 *
 * Provides safe, lazy-loading of JSON schemas with caching
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Cache for loaded schemas
const schemaCache = new Map<string, object>()

/**
 * Load a JSON schema from the schemas directory
 * Returns empty object if schema file doesn't exist
 *
 * @param filename - Name of the schema file (e.g., 'health-ping-output.json')
 * @returns Parsed JSON schema or empty object if not found
 */
export function loadSchema(filename: string): object {
  // Check cache first
  if (schemaCache.has(filename)) {
    return schemaCache.get(filename)!
  }

  const schemaPath = join(__dirname, '..', 'schemas', filename)

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
    schemaCache.set(filename, schema)
    return schema
  } catch (err) {
    console.error(`Failed to load schema ${filename}:`, err)
    const emptySchema = {}
    schemaCache.set(filename, emptySchema)
    return emptySchema
  }
}
