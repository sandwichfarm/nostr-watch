#!/usr/bin/env node
/**
 * RelayVM CLI Tool
 *
 * Utility for managing RelayVM instances and configuration
 */

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]

/**
 * Parse --config <path> from args
 */
function parseConfigFlag(): string | undefined {
  const idx = args.indexOf('--config')
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1]
  }
  return undefined
}

/**
 * Display usage information
 */
function showUsage() {
  console.log(`
RelayVM CLI Tool

Usage:
  relayvm <command> [options]

Commands:
  config:validate       Validate configuration [--config <path>]
  config:show           Show current configuration (sanitized) [--config <path>]
  health                Check server health
  cache:stats           Show cache statistics
  state:backups         List state database backups [--config <path>]
  state:restore <path>  Restore state database from backup [--config <path>]
  relay:test <url>      Test relay connectivity
  key:generate          Generate a new nsec key pair
  version               Show version information
  help                  Show this help message

Examples:
  relayvm config:validate
  relayvm config:show
  relayvm health
  relayvm cache:stats
  relayvm state:backups
  relayvm state:restore /backups/rstate-state.json.pre-migration-v1-to-v2.2026-06-12T10-00-00-000Z.json
  relayvm relay:test wss://relay.damus.io
  relayvm key:generate
  relayvm version
`)
}

/**
 * Validate configuration
 */
async function validateConfig() {
  console.log('Validating RelayVM configuration...\n')

  try {
    const { getConfig, getConfigSource } = await import('./config.js')
    const configPath = parseConfigFlag()
    const config = getConfig(configPath)
    const source = getConfigSource()
    console.log(`Config source: ${source}\n`)

    const errors: string[] = []
    const warnings: string[] = []

    // Check CVM configuration (only if enabled)
    if (config.cvm?.enabled) {
      if (!config.cvm.serverKey) {
        errors.push('CVM_SERVER_NSEC is required when CVM_ENABLED=true')
      } else if (!config.cvm.serverKey.startsWith('nsec1')) {
        warnings.push('CVM_SERVER_NSEC should be in nsec1... format (hex also supported)')
      }

      if (!config.cvm.cvmRelays || config.cvm.cvmRelays.length === 0) {
        errors.push('CVM_RELAYS must contain at least one relay when CVM_ENABLED=true')
      } else {
        config.cvm.cvmRelays.forEach((relay, i) => {
          if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
            errors.push(`CVM_RELAYS[${i}]: Invalid WebSocket URL: ${relay}`)
          }
        })
      }
    }

    if (!config.ingestRelays || config.ingestRelays.length === 0) {
      errors.push('INGEST_RELAYS must contain at least one relay')
    } else {
      config.ingestRelays.forEach((relay, i) => {
        if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
          errors.push(`INGEST_RELAYS[${i}]: Invalid WebSocket URL: ${relay}`)
        }
      })
    }

    if (config.trustedRelayAssertions.enabled) {
      if (!config.trustedRelayAssertions.relays || config.trustedRelayAssertions.relays.length === 0) {
        errors.push('TRA_RELAYS must contain at least one relay when TRA_ENABLED=true')
      }
      config.trustedRelayAssertions.relays.forEach((relay, i) => {
        if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
          errors.push(`TRA_RELAYS[${i}]: Invalid WebSocket URL: ${relay}`)
        }
      })
    }

    if (config.stateDatabase.enabled) {
      if (!config.stateDatabase.path) {
        errors.push('STATE_DB_PATH is required when STATE_DB_ENABLED=true')
      }
      if (!config.stateDatabase.backupDir) {
        errors.push('STATE_BACKUP_DIR is required when STATE_DB_ENABLED=true')
      }
      if (config.stateDatabase.backupRetention < 1) {
        errors.push(`STATE_BACKUP_RETENTION must be at least 1, got: ${config.stateDatabase.backupRetention}`)
      }
    }

    // Check numeric ranges
    if (config.aggregation.quorum < 0 || config.aggregation.quorum > 1) {
      errors.push(`AGG_QUORUM must be between 0 and 1, got: ${config.aggregation.quorum}`)
    }

    if (config.aggregation.labelQuorum < 0 || config.aggregation.labelQuorum > 1) {
      errors.push(`AGG_LABEL_QUORUM must be between 0 and 1, got: ${config.aggregation.labelQuorum}`)
    }

    // Check cache configuration
    if (config.cache.maxSize < 100) {
      warnings.push(`CACHE_MAX_SIZE is very small: ${config.cache.maxSize} (minimum recommended: 1000)`)
    }

    if (config.cache.ttlSeconds < 10) {
      warnings.push(`CACHE_TTL_SECONDS is very short: ${config.cache.ttlSeconds}s (minimum recommended: 30s)`)
    }

    // Check REST API configuration
    if (config.rest.enabled) {
      if (config.rest.rateLimit.enabled) {
        if (config.rest.rateLimit.requestsPerSecond < 1) {
          errors.push(`REST_RATE_LIMIT_RPS must be at least 1, got: ${config.rest.rateLimit.requestsPerSecond}`)
        }
        if (config.rest.rateLimit.maxBurst < config.rest.rateLimit.requestsPerSecond) {
          warnings.push(`REST_RATE_LIMIT_BURST (${config.rest.rateLimit.maxBurst}) should be >= REST_RATE_LIMIT_RPS (${config.rest.rateLimit.requestsPerSecond})`)
        }
      }

      if (config.rest.corsOrigins === '*') {
        warnings.push('REST_CORS_ORIGINS is set to "*" (allow all). Consider restricting to specific domains in production.')
      }
    }

    // Display results
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✓ Configuration is valid!\n')
      console.log('Configuration summary:')
      if (config.cvm?.enabled) {
        console.log(`  CVM Transport: enabled`)
        console.log(`  Transport relays: ${config.cvm.cvmRelays.length}`)
      } else {
        console.log(`  CVM Transport: disabled`)
      }
      if (config.rest.enabled) {
        console.log(`  REST API: enabled on ${config.rest.host}:${config.rest.port}`)
      } else {
        console.log(`  REST API: disabled`)
      }
      console.log(`  Ingestion relays: ${config.ingestRelays.length}`)
      console.log(`  Trusted Relay Assertions: ${config.trustedRelayAssertions.enabled ? 'enabled' : 'disabled'} (${config.trustedRelayAssertions.pubkeys.length} pubkeys)`)
      console.log(`  State database: ${config.stateDatabase.enabled ? config.stateDatabase.path : 'disabled'}`)
      console.log(`  Cache: ${config.cache.maxSize} entries, ${config.cache.ttlSeconds}s TTL`)
      return 0
    }

    if (errors.length > 0) {
      console.log('✗ Configuration errors:\n')
      errors.forEach(err => console.log(`  ERROR: ${err}`))
      console.log('')
    }

    if (warnings.length > 0) {
      console.log('⚠ Configuration warnings:\n')
      warnings.forEach(warn => console.log(`  WARNING: ${warn}`))
      console.log('')
    }

    return errors.length > 0 ? 1 : 0
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Configuration error: ${error.message}\n`)
    return 1
  }
}

/**
 * Show current configuration (sanitized)
 */
async function showConfig() {
  try {
    const { getConfig, getConfigSource } = await import('./config.js')
    const configPath = parseConfigFlag()
    const config = getConfig(configPath)

    console.log('RelayVM Configuration:\n')
    console.log(`Config source: ${getConfigSource()}\n`)

    console.log('Transports:')
    if (config.cvm?.enabled) {
      console.log(`  CVM: enabled`)
      console.log(`    Identity: ${config.cvm.serverKey.substring(0, 10)}...`)
      console.log(`    Encryption: ${config.cvm.encryptionMode}`)
      console.log(`    Transport Relays (${config.cvm.cvmRelays.length}):`)
      config.cvm.cvmRelays.forEach(relay => console.log(`      - ${relay}`))
    } else {
      console.log(`  CVM: disabled`)
    }
    if (config.rest.enabled) {
      console.log(`  REST: enabled on ${config.rest.host}:${config.rest.port}`)
    } else {
      console.log(`  REST: disabled`)
    }

    console.log('\nIngestion:')
    console.log(`  Relays (${config.ingestRelays.length}):`)
    config.ingestRelays.forEach(relay => console.log(`    - ${relay}`))

    console.log('\nTrusted Relay Assertions:')
    console.log(`  Enabled: ${config.trustedRelayAssertions.enabled}`)
    console.log(`  Relays (${config.trustedRelayAssertions.relays.length}):`)
    config.trustedRelayAssertions.relays.forEach(relay => console.log(`    - ${relay}`))
    console.log(`  Provider Pubkeys (${config.trustedRelayAssertions.pubkeys.length}):`)
    config.trustedRelayAssertions.pubkeys.forEach(pubkey => console.log(`    - ${pubkey}`))

    console.log('\nState Database:')
    console.log(`  Enabled: ${config.stateDatabase.enabled}`)
    console.log(`  Path: ${config.stateDatabase.path}`)
    console.log(`  Backup Dir: ${config.stateDatabase.backupDir}`)
    console.log(`  Backup Retention: ${config.stateDatabase.backupRetention}`)

    console.log('\nAggregation Policy:')
    console.log(`  Quorum: ${config.aggregation.quorum}`)
    console.log(`  Label Quorum: ${config.aggregation.labelQuorum}`)
    console.log(`  MAD Scale: ${config.aggregation.madScale}`)

    console.log('\nCache:')
    console.log(`  Max Size: ${config.cache.maxSize}`)
    console.log(`  TTL: ${config.cache.ttlSeconds}s`)

    if (config.rest.enabled) {
      console.log('\nREST API:')
      console.log(`  Enabled: yes`)
      console.log(`  Host: ${config.rest.host}`)
      console.log(`  Port: ${config.rest.port}`)
      console.log(`  CORS: ${config.rest.corsOrigins}`)
      console.log(`  Swagger: ${config.rest.enableSwagger ? 'enabled' : 'disabled'}`)
      console.log(`  Rate Limiting: ${config.rest.rateLimit.enabled ? 'enabled' : 'disabled'}`)
      if (config.rest.rateLimit.enabled) {
        console.log(`    - RPS: ${config.rest.rateLimit.requestsPerSecond}`)
        console.log(`    - Burst: ${config.rest.rateLimit.maxBurst}`)
      }
    }

    if (config.cvm?.enabled) {
      console.log('\nCVM Security:')
      console.log(`  Auth Enabled: ${config.cvm.auth.enabled}`)
      console.log(`  Allow Any Pubkey: ${config.cvm.auth.allowAny}`)
      console.log(`  Allowed Pubkeys: ${config.cvm.allowedPubkeys.length}`)
    }

    console.log('\nLogging:')
    console.log(`  Level: ${config.log.level}`)
    console.log(`  Destination: ${config.log.destination}`)
    console.log(`  Enabled: ${config.log.enabled}`)

    return 0
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Error reading configuration: ${error.message}`)
    return 1
  }
}

/**
 * Show cache statistics
 */
async function showCacheStats() {
  try {
    const { getConfig } = await import('./config.js')
    const config = getConfig()

    if (!config.rest.enabled) {
      console.log('REST API is not enabled. Cannot check cache stats.')
      return 1
    }

    const url = `http://${config.rest.host}:${config.rest.port}/health/ping`

    const response = await fetch(url)
    if (!response.ok) {
      console.log(`✗ Failed to fetch cache stats: ${response.statusText}`)
      return 1
    }

    const health = await response.json() as Record<string, unknown>

    if (!health.cache || typeof health.cache !== 'object') {
      console.log('✗ No cache stats available')
      return 1
    }

    const cache = health.cache as Record<string, unknown>

    console.log('Cache Statistics:\n')
    const size = Number(cache.size)
    const maxSize = Number(cache.maxSize)
    const usage = (size / maxSize) * 100

    console.log(`Size: ${size} / ${maxSize} (${usage.toFixed(1)}% full)`)
    console.log(`Hit Rate: ${Number(cache.hitRatePercent).toFixed(2)}%`)
    console.log(`Hits: ${cache.hits}`)
    console.log(`Misses: ${cache.misses}`)
    console.log(`Total Requests: ${Number(cache.hits) + Number(cache.misses)}`)

    console.log('\nRecommendations:')
    const hitRate = Number(cache.hitRate)
    if (hitRate < 0.5) {
      console.log('  ⚠ Low hit rate. Consider increasing CACHE_TTL_SECONDS or CACHE_MAX_SIZE')
    } else if (hitRate > 0.9) {
      console.log('  ✓ Excellent hit rate')
    } else {
      console.log('  ✓ Good hit rate')
    }

    if (usage > 90) {
      console.log('  ⚠ Cache nearly full. Consider increasing CACHE_MAX_SIZE')
    } else if (usage < 20) {
      console.log('  ℹ Cache usage is low. You may reduce CACHE_MAX_SIZE to save memory')
    }

    return 0
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Failed to connect: ${error.message}`)
    return 1
  }
}

async function listStateBackups() {
  try {
    const { getConfig } = await import('./config.js')
    const { StateDatabaseService } = await import('./services/state-database.js')
    const config = getConfig(parseConfigFlag())

    if (!config.stateDatabase.enabled) {
      console.log('State database is disabled.')
      return 1
    }

    const database = new StateDatabaseService(config.stateDatabase)
    const backups = await database.listBackups()

    if (backups.length === 0) {
      console.log(`No backups found in ${config.stateDatabase.backupDir}`)
      return 0
    }

    console.log(`State database backups (${backups.length}):\n`)
    backups.forEach((backup) => {
      console.log(`${backup.createdAt}  ${backup.sizeBytes} bytes  ${backup.path}`)
    })
    return 0
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Failed to list backups: ${error.message}`)
    return 1
  }
}

async function restoreStateBackup(backupPath: string) {
  try {
    const { getConfig } = await import('./config.js')
    const { StateDatabaseService } = await import('./services/state-database.js')
    const config = getConfig(parseConfigFlag())

    if (!config.stateDatabase.enabled) {
      console.log('State database is disabled.')
      return 1
    }

    const database = new StateDatabaseService(config.stateDatabase)
    const snapshot = await database.restoreFromBackup(backupPath)
    console.log(`✓ Restored state database from ${backupPath}`)
    console.log(`  Monitors: ${snapshot.monitors.length}`)
    console.log(`  Observations: ${snapshot.observations.length}`)
    console.log(`  Trusted Relay Assertions: ${snapshot.trustedRelayAssertions.length}`)
    return 0
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Failed to restore backup: ${error.message}`)
    return 1
  }
}

/**
 * Check server health
 */
async function checkHealth() {
  try {
    const { getConfig } = await import('./config.js')
    const config = getConfig()

    if (!config.rest.enabled) {
      console.log('REST API is not enabled. Cannot check health.')
      return 1
    }

    const url = `http://${config.rest.host}:${config.rest.port}/health/ping`

    console.log(`Checking health at ${url}...\n`)

    const response = await fetch(url)
    if (!response.ok) {
      console.log(`✗ Health check failed: ${response.statusText}`)
      return 1
    }

    const health = await response.json() as Record<string, unknown>

    console.log(`Status: ${health.status === 'ok' ? '✓' : '✗'} ${String(health.status)}`)
    console.log(`Version: ${String(health.version)}`)
    console.log(`Uptime: ${Math.floor(Number(health.uptime) / 60)} minutes`)

    if (health.relayCount && typeof health.relayCount === 'object') {
      const relayCount = health.relayCount as Record<string, unknown>
      console.log(`\nRelays:`)
      console.log(`  Transport: ${String(relayCount.transport)}`)
      console.log(`  Ingestion: ${String(relayCount.ingestion)}`)
    }

    console.log(`\nObservations: ${String(health.observationCount)}`)

    if (health.cache && typeof health.cache === 'object') {
      const cache = health.cache as Record<string, unknown>
      console.log(`\nCache:`)
      console.log(`  Size: ${String(cache.size)} / ${String(cache.maxSize)}`)
      console.log(`  Hit Rate: ${Number(cache.hitRatePercent).toFixed(2)}%`)
    }

    return health.status === 'ok' ? 0 : 1
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Failed to connect: ${error.message}`)
    return 1
  }
}

/**
 * Test relay connectivity
 */
async function testRelay(url: string) {
  console.log(`Testing relay connectivity: ${url}\n`)

  if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
    console.log('✗ Invalid relay URL. Must start with wss:// or ws://')
    return 1
  }

  try {
    const ws = new WebSocket(url)

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('Connection timeout (5s)'))
      }, 5000)

      ws.onopen = () => {
        clearTimeout(timeout)
        console.log('✓ Connection established')

        // Send NIP-01 REQ to test
        ws.send(JSON.stringify(['REQ', 'test', { kinds: [0], limit: 1 }]))
      }

      ws.onmessage = () => {
        console.log('✓ Relay responding')
        ws.close()
        clearTimeout(timeout)
        resolve(true)
      }

      ws.onerror = (err) => {
        clearTimeout(timeout)
        reject(err)
      }
    })

    console.log('✓ Relay test passed')
    return 0
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Relay test failed: ${error.message}`)
    return 1
  }
}

/**
 * Simple bech32 encoding for NIP-19
 * Based on BIP 173
 */
function bech32Encode(prefix: string, data: Uint8Array): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

  function polymod(values: number[]): number {
    let chk = 1
    for (const value of values) {
      const top = chk >> 25
      chk = (chk & 0x1ffffff) << 5 ^ value
      for (let i = 0; i < 5; i++) {
        if ((top >> i) & 1) {
          chk ^= GENERATOR[i]
        }
      }
    }
    return chk
  }

  function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
    let acc = 0
    let bits = 0
    const result: number[] = []
    const maxv = (1 << toBits) - 1
    for (const value of data) {
      acc = (acc << fromBits) | value
      bits += fromBits
      while (bits >= toBits) {
        bits -= toBits
        result.push((acc >> bits) & maxv)
      }
    }
    if (pad) {
      if (bits > 0) {
        result.push((acc << (toBits - bits)) & maxv)
      }
    }
    return result
  }

  const prefixBytes = []
  for (let i = 0; i < prefix.length; i++) {
    prefixBytes.push(prefix.charCodeAt(i) >> 5)
  }
  prefixBytes.push(0)
  for (let i = 0; i < prefix.length; i++) {
    prefixBytes.push(prefix.charCodeAt(i) & 31)
  }

  const words = convertBits(data, 8, 5, true)
  const checksumValues = prefixBytes.concat(words).concat([0, 0, 0, 0, 0, 0])
  const checksum = polymod(checksumValues) ^ 1
  const checksumWords: number[] = []
  for (let i = 0; i < 6; i++) {
    checksumWords.push((checksum >> (5 * (5 - i))) & 31)
  }

  return prefix + '1' + words.concat(checksumWords).map(w => CHARSET[w]).join('')
}

/**
 * Generate a new key pair
 */
async function generateKey() {
  console.log('Generating new Nostr key pair...\n')

  try {
    // Dynamic import of crypto libraries
    const { utils, getPublicKey } = await import('@noble/secp256k1')

    const privateKeyBytes = utils.randomPrivateKey()
    const publicKeyBytes = getPublicKey(privateKeyBytes, true).slice(1) // Remove 0x04 prefix for x-only pubkey

    const nsec = bech32Encode('nsec', privateKeyBytes)
    const npub = bech32Encode('npub', publicKeyBytes)

    console.log('Private key (keep secret!):')
    console.log(`  nsec: ${nsec}`)
    console.log(`  hex:  ${Buffer.from(privateKeyBytes).toString('hex')}`)
    console.log('')
    console.log('Public key:')
    console.log(`  npub: ${npub}`)
    console.log(`  hex:  ${Buffer.from(publicKeyBytes).toString('hex')}`)
    console.log('')
    console.log('Add to .env file:')
    console.log(`  CVM_SERVER_NSEC=${nsec}`)

    return 0
  } catch (err: unknown) {
    const error = err as Error
    console.log(`✗ Failed to generate key: ${error.message}`)
    return 1
  }
}

/**
 * Show version information
 */
async function showVersion() {
  try {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const { fileURLToPath } = await import('url')

    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    const packagePath = resolve(__dirname, '..', 'package.json')

    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
    console.log(`RelayVM v${pkg.version}`)
  } catch {
    console.log('RelayVM (version unknown)')
  }

  return 0
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    switch (command) {
      case 'config:validate':
        return await validateConfig()

      case 'config:show':
        return await showConfig()

      case 'health':
        return await checkHealth()

      case 'cache:stats':
        return await showCacheStats()

      case 'state:backups':
        return await listStateBackups()

      case 'state:restore':
        if (args.length < 2) {
          console.log('Usage: relayvm state:restore <backup-path> [--config <path>]')
          return 1
        }
        return await restoreStateBackup(args[1])

      case 'relay:test':
        if (args.length < 2) {
          console.log('Usage: relayvm relay:test <url>')
          return 1
        }
        return await testRelay(args[1])

      case 'key:generate':
        return await generateKey()

      case 'version':
        return await showVersion()

      case 'help':
      case undefined:
        showUsage()
        return 0

      default:
        console.log(`Unknown command: ${command}\n`)
        showUsage()
        return 1
    }
  } catch (err: unknown) {
    const error = err as Error
    console.error(`Error: ${error.message}`)
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack)
    }
    return 1
  }
}

// Run CLI
main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
