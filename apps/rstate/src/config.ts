/**
 * Configuration System
 *
 * Loads and validates configuration from environment variables
 */

import type { AggregationPolicy } from './types/aggregation.js'
import { DEFAULT_POLICY } from './types/aggregation.js'

export type EncryptionMode = 'OPTIONAL' | 'REQUIRED' | 'DISABLED'
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogDestination = 'stdout' | 'stderr' | 'file'

export type PublishSchedule = 'hourly' | 'every30m' | 'every15m' | 'every5m'

export interface Config {
  // CVM Server (Optional - only required if CVM transport is enabled)
  cvm?: {
    enabled: boolean
    cvmRelays: string[]
    serverKey: string  // nsec or hex
    encryptionMode: EncryptionMode
    allowedPubkeys: string[]  // empty = no restrictions
    auth: {
      enabled: boolean
      allowAny: boolean
    }
  }

  // Event Publishing (Optional)
  publishing?: {
    enabled: boolean
    publishRelays: string[]
    signingKey: string  // nsec or hex — PUBLISH_SIGNING_KEY, no CVM fallback
    kind1066: {
      enabled: boolean
      schedule: PublishSchedule
    }
    kind20066: { enabled: boolean }
    kind1166: {
      enabled: boolean
      schedule: PublishSchedule
    }
    announce: {
      profile?: { name?: string; about?: string; picture?: string }
      frequency: string
      userDataRelays?: string[]
    }
  }

  // REST API
  rest: {
    enabled: boolean
    host: string
    port: number
    apiBaseUrl?: string  // Base URL for OpenAPI spec (e.g., https://api.nostr.watch)
    corsOrigins: string[] | '*'
    enableSwagger: boolean
    allowPolicyUpdate: boolean
    rateLimit: {
      enabled: boolean
      requestsPerSecond: number
      maxBurst: number
    }
  }

  // Ingestion
  ingestRelays: string[]

  // Logging
  log: {
    enabled: boolean
    level: LogLevel
    destination: LogDestination
    file?: string
  }

  // Aggregation
  aggregation: AggregationPolicy

  // Cache
  cache: {
    maxSize: number
    ttlSeconds: number
  }
}

/**
 * Parse comma-separated list
 */
function parseList(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value || value.trim() === '') return defaultValue
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

/**
 * Parse number with fallback
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = Number(value)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Validate relay URLs
 */
function validateRelayUrls(urls: string[]): void {
  for (const url of urls) {
    try {
      const parsed = new URL(url)
      if (!['ws:', 'wss:'].includes(parsed.protocol)) {
        throw new Error(`Invalid protocol: ${parsed.protocol}`)
      }
    } catch (err) {
      throw new Error(`Invalid relay URL: ${url} - ${err}`)
    }
  }
}

/**
 * Validate encryption mode
 */
function validateEncryptionMode(mode: string | undefined): EncryptionMode {
  const valid: EncryptionMode[] = ['OPTIONAL', 'REQUIRED', 'DISABLED']
  const upper = (mode || 'OPTIONAL').toUpperCase()
  if (!valid.includes(upper as EncryptionMode)) {
    throw new Error(`Invalid encryption mode: ${mode}. Must be one of: ${valid.join(', ')}`)
  }
  return upper as EncryptionMode
}

/**
 * Validate log level
 */
function validateLogLevel(level: string | undefined): LogLevel {
  const valid: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
  const lower = (level || 'info').toLowerCase()
  if (!valid.includes(lower as LogLevel)) {
    throw new Error(`Invalid log level: ${level}. Must be one of: ${valid.join(', ')}`)
  }
  return lower as LogLevel
}

/**
 * Validate log destination
 */
function validateLogDestination(dest: string | undefined): LogDestination {
  const valid: LogDestination[] = ['stdout', 'stderr', 'file']
  const lower = (dest || 'stdout').toLowerCase()
  if (!valid.includes(lower as LogDestination)) {
    throw new Error(`Invalid log destination: ${dest}. Must be one of: ${valid.join(', ')}`)
  }
  return lower as LogDestination
}

/**
 * Validate publish schedule preset
 */
function validatePublishSchedule(value: string | undefined): PublishSchedule {
  const valid: PublishSchedule[] = ['hourly', 'every30m', 'every15m', 'every5m']
  const lower = (value || 'hourly').toLowerCase()
  if (!valid.includes(lower as PublishSchedule)) {
    throw new Error(`Invalid publish schedule: ${value}. Must be one of: ${valid.join(', ')}`)
  }
  return lower as PublishSchedule
}

/**
 * Validate private key (nsec or hex)
 */
function validatePrivateKey(key: string | undefined): string {
  if (!key || key.trim() === '') {
    throw new Error('CVM_SERVER_NSEC is required')
  }
  const trimmed = key.trim()

  // Check if nsec format
  if (trimmed.startsWith('nsec1')) {
    if (trimmed.length < 60) {
      throw new Error('Invalid nsec format: too short')
    }
    return trimmed
  }

  // Check if hex format (64 hex chars)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed
  }

  throw new Error('Invalid private key format. Must be nsec1... or 64-character hex string')
}

/**
 * Validate that transport relays are local only (prevent production pollution)
 * Can be bypassed with CVM_ALLOW_PRODUCTION_RELAYS=true or NODE_ENV=production
 */
function validateLocalRelaysOnly(relays: string[], env: string): void {
  // Allow production relays if explicitly enabled
  const allowProductionRelays =
    process.env.CVM_ALLOW_PRODUCTION_RELAYS?.toLowerCase() === 'true' ||
    process.env.NODE_ENV === 'production'

  if (allowProductionRelays) {
    return
  }

  const productionHosts = [
    'relay.contextvm.org',
    'relay.nostr.watch',
    'relay.nostr.band',
    'nos.lol',
    'relay.damus.io',
    'relay.snort.social',
    'nostr.wine',
  ]

  for (const relay of relays) {
    const url = new URL(relay)
    const isLocal = url.hostname === 'localhost' ||
                    url.hostname === '127.0.0.1' ||
                    url.hostname === '0.0.0.0' ||
                    url.hostname.endsWith('.local')

    if (!isLocal) {
      // Check if it's a known production relay
      const isProduction = productionHosts.some(host => url.hostname.includes(host))

      if (isProduction) {
        throw new Error(
          `CRITICAL: ${env} contains PRODUCTION relay: ${relay}\n` +
          `Transport relays MUST be local to prevent polluting production with test data!\n` +
          `Use: ws://localhost:6969 (start with: nak serve --port 6969)\n` +
          `See .env.development.safe for safe configuration.\n` +
          `To allow production relays, set: CVM_ALLOW_PRODUCTION_RELAYS=true or NODE_ENV=production`
        )
      }

      // Warn about non-local relay that isn't known production
      console.warn(
        `WARNING: ${env} contains non-local relay: ${relay}\n` +
        `Transport relays should be local to prevent accidental data pollution.\n` +
        `Recommended: ws://localhost:6969`
      )
    }
  }
}

/**
 * Load configuration from environment
 */
export function loadConfig(): Config {
  // Transport configuration
  const cvmEnabled = (process.env.CVM_ENABLED ?? 'true').toLowerCase() === 'true'
  const restEnabled = (process.env.REST_ENABLED ?? 'false').toLowerCase() === 'true'

  // Validate at least one transport is enabled
  if (!cvmEnabled && !restEnabled) {
    throw new Error(
      'At least one transport must be enabled: CVM_ENABLED=true or REST_ENABLED=true\n' +
      'Set CVM_ENABLED=true for Nostr MCP transport, or REST_ENABLED=true for HTTP REST API'
    )
  }

  // CVM Server (conditional - only if enabled)
  let cvmConfig: Config['cvm'] | undefined
  if (cvmEnabled) {
    const cvmRelays = parseList(process.env.CVM_RELAYS)
    if (cvmRelays.length === 0) {
      throw new Error('CVM_RELAYS is required when CVM_ENABLED=true (comma-separated wss:// URLs)')
    }
    validateRelayUrls(cvmRelays)

    // CRITICAL: Validate transport relays are local only
    validateLocalRelaysOnly(cvmRelays, 'CVM_RELAYS')

    const serverKey = validatePrivateKey(process.env.CVM_SERVER_NSEC)
    const encryptionMode = validateEncryptionMode(process.env.CVM_ENCRYPTION_MODE)
    const allowedPubkeys = parseList(process.env.CVM_ALLOWED_PUBKEYS)
    const authEnabled = (process.env.CVM_AUTH_ENABLED ?? 'true').toLowerCase() !== 'false'
    const authAllowAny = (process.env.CVM_AUTH_ALLOW_ANY ?? 'false').toLowerCase() === 'true'

    cvmConfig = {
      enabled: true,
      cvmRelays,
      serverKey,
      encryptionMode,
      allowedPubkeys,
      auth: {
        enabled: authEnabled,
        allowAny: authAllowAny,
      },
    }
  }

  // Ingestion
  const ingestRelays = parseList(process.env.INGEST_RELAYS)
  if (ingestRelays.length === 0) {
    throw new Error('INGEST_RELAYS is required (comma-separated wss:// URLs)')
  }
  validateRelayUrls(ingestRelays)

  // Logging
  const logEnabled = process.env.LOG_ENABLED !== 'false'
  const logLevel = validateLogLevel(process.env.LOG_LEVEL)
  const logDestination = validateLogDestination(process.env.LOG_DESTINATION)
  const logFile = process.env.LOG_FILE

  if (logDestination === 'file' && !logFile) {
    throw new Error('LOG_FILE is required when LOG_DESTINATION=file')
  }

  // REST API
  const restHost = process.env.REST_HOST || '127.0.0.1'
  const restPort = parseNumber(process.env.REST_PORT, 3000)

  // API Base URL for OpenAPI spec - defaults to production URL in production, otherwise local
  const restApiBaseUrl = process.env.API_BASE_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://api.nostr.watch'
      : undefined)  // undefined = use host:port format

  const restCorsOrigins = process.env.REST_CORS_ORIGINS === '*'
    ? '*'
    : parseList(process.env.REST_CORS_ORIGINS, ['http://localhost:3000'])
  const restEnableSwagger = (process.env.REST_ENABLE_SWAGGER ?? 'true').toLowerCase() === 'true'
  const restAllowPolicyUpdate = (process.env.REST_ALLOW_POLICY_UPDATE ?? 'false').toLowerCase() === 'true'
  const restRateLimitEnabled = (process.env.REST_RATE_LIMIT_ENABLED ?? 'true').toLowerCase() === 'true'
  const restRateLimitRequestsPerSecond = parseNumber(process.env.REST_RATE_LIMIT_RPS, 10)
  const restRateLimitMaxBurst = parseNumber(process.env.REST_RATE_LIMIT_BURST, 100)

  // Aggregation policy
  const aggregation: AggregationPolicy = {
    ...DEFAULT_POLICY,
    lookbackSeconds: parseNumber(process.env.AGG_LOOKBACK_SECONDS, DEFAULT_POLICY.lookbackSeconds),
    quorum: parseNumber(process.env.AGG_QUORUM, DEFAULT_POLICY.quorum),
    labelQuorum: parseNumber(process.env.AGG_LABEL_QUORUM, DEFAULT_POLICY.labelQuorum),
    madScale: parseNumber(process.env.AGG_MAD_SCALE, DEFAULT_POLICY.madScale),
  }

  // Event Publishing
  const publishEnabled = (process.env.PUBLISH_ENABLED ?? 'false').toLowerCase() === 'true'
  let publishingConfig: Config['publishing'] | undefined
  if (publishEnabled) {
    const publishRelays = parseList(process.env.PUBLISH_RELAYS)
    if (publishRelays.length === 0) {
      throw new Error('PUBLISH_RELAYS is required when PUBLISH_ENABLED=true (comma-separated wss:// URLs)')
    }
    validateRelayUrls(publishRelays)
    validateLocalRelaysOnly(publishRelays, 'PUBLISH_RELAYS')

    const signingKey = process.env.PUBLISH_SIGNING_KEY
    if (!signingKey || signingKey.trim() === '') {
      throw new Error('PUBLISH_SIGNING_KEY is required when PUBLISH_ENABLED=true')
    }

    const kind1066Schedule = validatePublishSchedule(process.env.PUBLISH_KIND1066_SCHEDULE)
    const kind1166Schedule = validatePublishSchedule(process.env.PUBLISH_KIND1166_SCHEDULE)

    // Announce config
    const announceProfile: { name?: string; about?: string; picture?: string } = {}
    if (process.env.PUBLISH_PROFILE_NAME) announceProfile.name = process.env.PUBLISH_PROFILE_NAME
    if (process.env.PUBLISH_PROFILE_ABOUT) announceProfile.about = process.env.PUBLISH_PROFILE_ABOUT
    if (process.env.PUBLISH_PROFILE_PICTURE) announceProfile.picture = process.env.PUBLISH_PROFILE_PICTURE

    const announceFrequency = process.env.PUBLISH_FREQUENCY || '3600'
    const announceUserDataRelays = parseList(process.env.PUBLISH_USER_DATA_RELAYS)

    publishingConfig = {
      enabled: true,
      publishRelays,
      signingKey: signingKey.trim(),
      kind1066: {
        enabled: (process.env.PUBLISH_KIND1066_ENABLED ?? 'true').toLowerCase() !== 'false',
        schedule: kind1066Schedule,
      },
      kind20066: {
        enabled: (process.env.PUBLISH_KIND20066_ENABLED ?? 'true').toLowerCase() !== 'false',
      },
      kind1166: {
        enabled: (process.env.PUBLISH_KIND1166_ENABLED ?? 'true').toLowerCase() !== 'false',
        schedule: kind1166Schedule,
      },
      announce: {
        profile: Object.keys(announceProfile).length > 0 ? announceProfile : undefined,
        frequency: announceFrequency,
        userDataRelays: announceUserDataRelays.length > 0 ? announceUserDataRelays : undefined,
      },
    }
  }

  // Cache
  const cacheMaxSize = parseNumber(process.env.CACHE_MAX_SIZE, 10000)
  const cacheTtlSeconds = parseNumber(process.env.CACHE_TTL_SECONDS, 60)

  return {
    cvm: cvmConfig,
    rest: {
      enabled: restEnabled,
      host: restHost,
      port: restPort,
      apiBaseUrl: restApiBaseUrl,
      corsOrigins: restCorsOrigins,
      enableSwagger: restEnableSwagger,
      allowPolicyUpdate: restAllowPolicyUpdate,
      rateLimit: {
        enabled: restRateLimitEnabled,
        requestsPerSecond: restRateLimitRequestsPerSecond,
        maxBurst: restRateLimitMaxBurst,
      },
    },
    ingestRelays,
    log: {
      enabled: logEnabled,
      level: logLevel,
      destination: logDestination,
      file: logFile,
    },
    aggregation,
    publishing: publishingConfig,
    cache: {
      maxSize: cacheMaxSize,
      ttlSeconds: cacheTtlSeconds,
    },
  }
}

/**
 * Global config instance (loaded once)
 */
let configInstance: Config | null = null

/**
 * Get config singleton
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig()
  }
  return configInstance
}

/**
 * Reset config (for testing)
 */
export function resetConfig(): void {
  configInstance = null
}
