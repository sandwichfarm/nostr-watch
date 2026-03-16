import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(__dirname, '..')

const { nipManifest } = await import('../src/nips/manifest.js')
const { suiteTests } = await import('../src/nips/suite-test-manifest.js')

const manifestKeys = Object.keys(nipManifest)
const suiteTestKeys = Object.keys(suiteTests)

const errors = []

// Check keys in nipManifest but not in suiteTests
const missingFromSuiteTests = manifestKeys.filter(k => !suiteTestKeys.includes(k))
if (missingFromSuiteTests.length > 0) {
  errors.push(`Keys in manifest.js but missing from suite-test-manifest.js: ${missingFromSuiteTests.join(', ')}`)
}

// Check keys in suiteTests but not in nipManifest
const missingFromManifest = suiteTestKeys.filter(k => !manifestKeys.includes(k))
if (missingFromManifest.length > 0) {
  errors.push(`Keys in suite-test-manifest.js but missing from manifest.js: ${missingFromManifest.join(', ')}`)
}

// Check file existence for each key in nipManifest
for (const key of manifestKeys) {
  const filePath = path.join(pkgRoot, 'src', 'nips', key, 'index.ts')
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing file for manifest.js key '${key}': ${filePath}`)
  }
}

// Check file existence for each key in suiteTests
for (const key of suiteTestKeys) {
  const filePath = path.join(pkgRoot, 'src', 'nips', key, 'tests', 'index.ts')
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing file for suite-test-manifest.js key '${key}': ${filePath}`)
  }
}

if (errors.length > 0) {
  console.error('Manifest consistency check FAILED:')
  for (const error of errors) {
    console.error(`  - ${error}`)
  }
  process.exit(1)
}

console.log('Manifest consistency check passed.')
