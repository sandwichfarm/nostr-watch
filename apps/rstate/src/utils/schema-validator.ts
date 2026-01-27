/**
 * JSON Schema Validation Utilities
 *
 * Validates tool outputs against declared JSON schemas
 */

import Ajv from 'ajv'

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  verbose: true,
})

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

/**
 * Validate data against a JSON Schema
 */
export function validateOutput(
  schema: Record<string, any>,
  data: any
): ValidationResult {
  const validate = ajv.compile(schema)
  const valid = validate(data)

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(err => {
        const path = err.instancePath || '(root)'
        return `${path}: ${err.message}`
      }),
    }
  }

  return { valid: true }
}
