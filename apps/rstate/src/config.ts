/**
 * Configuration System
 *
 * Loads configuration from YAML file with environment variable overrides.
 * Falls back to pure env-var mode when no YAML file is present.
 */

import fs from 'node:fs'
import { parse } from 'yaml'
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
    kind30385: {
      enabled: boolean
      schedule: PublishSchedule
      minObservations: number
      materialChangeThreshold: number
      historyRetention: number
      publishUnreachable: boolean
    }
    announce: {
      profile?: Record<string, unknown>
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

/** Tracks where the config was loaded from */
let configSource: string = 'env-only'

/**
 * Get the source of the loaded config (YAML file path or "env-only")
 */
export function getConfigSource(): string {
  return configSource
}

/**
 * Load and parse a YAML config file. Returns undefined if file does not exist.
 */
function loadYamlConfig(path: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(path)) return undefined
  const raw = fs.readFileSync(path, 'utf-8')
  const parsed = parse(raw)
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error(`Config file ${path} did not parse to an object`)
  }
  return parsed as Record<string, unknown>
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

// Helper: coerce a YAML value to boolean (matches env-var parsing conventions)
function toBool(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === 'boolean') return value
  return String(value).toLowerCase() === 'true'
}

// Helper: coerce YAML value to string array
function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return parseList(value)
  return undefined
}

// Helper: coerce YAML value to number
function toNumber(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null) return defaultValue
  const n = Number(value)
  return isNaN(n) ? defaultValue : n
}

/**
 * Build env overrides object from explicitly set environment variables.
 * Only includes values for env vars that are actually defined.
 */
function buildEnvOverrides(): Record<string, unknown> {
  const env = process.env
  const o: Record<string, unknown> = {}

  // CVM
  if (env.CVM_ENABLED !== undefined) o.cvmEnabled = env.CVM_ENABLED.toLowerCase() === 'true'
  if (env.CVM_RELAYS !== undefined) o.cvmRelays = parseList(env.CVM_RELAYS)
  if (env.CVM_SERVER_NSEC !== undefined) o.cvmServerKey = env.CVM_SERVER_NSEC
  if (env.CVM_ENCRYPTION_MODE !== undefined) o.cvmEncryptionMode = env.CVM_ENCRYPTION_MODE
  if (env.CVM_ALLOWED_PUBKEYS !== undefined) o.cvmAllowedPubkeys = parseList(env.CVM_ALLOWED_PUBKEYS)
  if (env.CVM_AUTH_ENABLED !== undefined) o.cvmAuthEnabled = env.CVM_AUTH_ENABLED.toLowerCase() !== 'false'
  if (env.CVM_AUTH_ALLOW_ANY !== undefined) o.cvmAuthAllowAny = env.CVM_AUTH_ALLOW_ANY.toLowerCase() === 'true'

  // REST
  if (env.REST_ENABLED !== undefined) o.restEnabled = env.REST_ENABLED.toLowerCase() === 'true'
  if (env.REST_HOST !== undefined) o.restHost = env.REST_HOST
  if (env.REST_PORT !== undefined) o.restPort = parseNumber(env.REST_PORT, 3000)
  if (env.API_BASE_URL !== undefined) o.restApiBaseUrl = env.API_BASE_URL
  if (env.REST_CORS_ORIGINS !== undefined) {
    o.restCorsOrigins = env.REST_CORS_ORIGINS === '*' ? '*' : parseList(env.REST_CORS_ORIGINS)
  }
  if (env.REST_ENABLE_SWAGGER !== undefined) o.restEnableSwagger = env.REST_ENABLE_SWAGGER.toLowerCase() === 'true'
  if (env.REST_ALLOW_POLICY_UPDATE !== undefined) o.restAllowPolicyUpdate = env.REST_ALLOW_POLICY_UPDATE.toLowerCase() === 'true'
  if (env.REST_RATE_LIMIT_ENABLED !== undefined) o.restRateLimitEnabled = env.REST_RATE_LIMIT_ENABLED.toLowerCase() === 'true'
  if (env.REST_RATE_LIMIT_RPS !== undefined) o.restRateLimitRps = parseNumber(env.REST_RATE_LIMIT_RPS, 10)
  if (env.REST_RATE_LIMIT_BURST !== undefined) o.restRateLimitBurst = parseNumber(env.REST_RATE_LIMIT_BURST, 100)

  // Ingestion
  if (env.INGEST_RELAYS !== undefined) o.ingestRelays = parseList(env.INGEST_RELAYS)

  // Log
  if (env.LOG_ENABLED !== undefined) o.logEnabled = env.LOG_ENABLED !== 'false'
  if (env.LOG_LEVEL !== undefined) o.logLevel = env.LOG_LEVEL
  if (env.LOG_DESTINATION !== undefined) o.logDestination = env.LOG_DESTINATION
  if (env.LOG_FILE !== undefined) o.logFile = env.LOG_FILE

  // Aggregation
  if (env.AGG_QUORUM !== undefined) o.aggQuorum = parseNumber(env.AGG_QUORUM, DEFAULT_POLICY.quorum)
  if (env.AGG_LABEL_QUORUM !== undefined) o.aggLabelQuorum = parseNumber(env.AGG_LABEL_QUORUM, DEFAULT_POLICY.labelQuorum)
  if (env.AGG_MAD_SCALE !== undefined) o.aggMadScale = parseNumber(env.AGG_MAD_SCALE, DEFAULT_POLICY.madScale)

  // Cache
  if (env.CACHE_MAX_SIZE !== undefined) o.cacheMaxSize = parseNumber(env.CACHE_MAX_SIZE, 10000)
  if (env.CACHE_TTL_SECONDS !== undefined) o.cacheTtlSeconds = parseNumber(env.CACHE_TTL_SECONDS, 60)

  // Publishing
  if (env.PUBLISH_ENABLED !== undefined) o.publishEnabled = env.PUBLISH_ENABLED.toLowerCase() === 'true'
  if (env.PUBLISH_RELAYS !== undefined) o.publishRelays = parseList(env.PUBLISH_RELAYS)
  if (env.PUBLISH_SIGNING_KEY !== undefined) o.publishSigningKey = env.PUBLISH_SIGNING_KEY
  if (env.PUBLISH_KIND1066_ENABLED !== undefined) o.publishKind1066Enabled = env.PUBLISH_KIND1066_ENABLED.toLowerCase() !== 'false'
  if (env.PUBLISH_KIND1066_SCHEDULE !== undefined) o.publishKind1066Schedule = env.PUBLISH_KIND1066_SCHEDULE
  if (env.PUBLISH_KIND20066_ENABLED !== undefined) o.publishKind20066Enabled = env.PUBLISH_KIND20066_ENABLED.toLowerCase() !== 'false'
  if (env.PUBLISH_KIND1166_ENABLED !== undefined) o.publishKind1166Enabled = env.PUBLISH_KIND1166_ENABLED.toLowerCase() !== 'false'
  if (env.PUBLISH_KIND1166_SCHEDULE !== undefined) o.publishKind1166Schedule = env.PUBLISH_KIND1166_SCHEDULE
  if (env.PUBLISH_KIND30385_ENABLED !== undefined) o.publishKind30385Enabled = env.PUBLISH_KIND30385_ENABLED.toLowerCase() === 'true'
  if (env.PUBLISH_KIND30385_SCHEDULE !== undefined) o.publishKind30385Schedule = env.PUBLISH_KIND30385_SCHEDULE
  if (env.PUBLISH_KIND30385_MIN_OBSERVATIONS !== undefined) o.publishKind30385MinObservations = parseNumber(env.PUBLISH_KIND30385_MIN_OBSERVATIONS, 3)
  if (env.PUBLISH_KIND30385_MATERIAL_CHANGE_THRESHOLD !== undefined) o.publishKind30385MaterialChangeThreshold = parseNumber(env.PUBLISH_KIND30385_MATERIAL_CHANGE_THRESHOLD, 0.05)
  if (env.PUBLISH_KIND30385_HISTORY_RETENTION !== undefined) o.publishKind30385HistoryRetention = parseNumber(env.PUBLISH_KIND30385_HISTORY_RETENTION, 86400)
  if (env.PUBLISH_KIND30385_PUBLISH_UNREACHABLE !== undefined) o.publishKind30385PublishUnreachable = env.PUBLISH_KIND30385_PUBLISH_UNREACHABLE.toLowerCase() === 'true'
  if (env.PUBLISH_FREQUENCY !== undefined) o.publishFrequency = env.PUBLISH_FREQUENCY
  if (env.PUBLISH_USER_DATA_RELAYS !== undefined) o.publishUserDataRelays = parseList(env.PUBLISH_USER_DATA_RELAYS)
  if (env.PUBLISH_PROFILE_NAME !== undefined) o.publishProfileName = env.PUBLISH_PROFILE_NAME
  if (env.PUBLISH_PROFILE_ABOUT !== undefined) o.publishProfileAbout = env.PUBLISH_PROFILE_ABOUT
  if (env.PUBLISH_PROFILE_PICTURE !== undefined) o.publishProfilePicture = env.PUBLISH_PROFILE_PICTURE

  return o
}

/**
 * Load configuration from YAML file + env overrides, or pure env vars as fallback.
 */
export function loadConfig(configFilePath?: string): Config {
  const yamlPath = configFilePath || process.env.CONFIG_FILE || './config.yaml'
  const yaml = loadYamlConfig(yamlPath)
  const envOverrides = buildEnvOverrides()

  if (yaml) {
    configSource = yamlPath
    return buildConfigFromYaml(yaml, envOverrides)
  }

  configSource = 'env-only'
  return buildConfigFromEnv()
}

/**
 * Build Config from a parsed YAML object with env overrides applied on top.
 */
function buildConfigFromYaml(yaml: Record<string, unknown>, env: Record<string, unknown>): Config {
  // --- CVM ---
  const cvmYaml = (yaml.cvm ?? {}) as Record<string, unknown>
  const cvmEnabled = env.cvmEnabled !== undefined
    ? env.cvmEnabled as boolean
    : toBool(cvmYaml.enabled, true)

  // --- REST ---
  const restYaml = (yaml.rest ?? {}) as Record<string, unknown>
  const restRateLimitYaml = (restYaml.rateLimit ?? {}) as Record<string, unknown>
  const restEnabled = env.restEnabled !== undefined
    ? env.restEnabled as boolean
    : toBool(restYaml.enabled, false)

  // Validate at least one transport
  if (!cvmEnabled && !restEnabled) {
    throw new Error(
      'At least one transport must be enabled: cvm.enabled or rest.enabled\n' +
      'Set cvm.enabled: true for Nostr MCP transport, or rest.enabled: true for HTTP REST API'
    )
  }

  // --- CVM Config ---
  let cvmConfig: Config['cvm'] | undefined
  if (cvmEnabled) {
    const cvmRelays = (env.cvmRelays as string[] | undefined)
      ?? toStringArray(cvmYaml.relays)
      ?? []
    if (cvmRelays.length === 0) {
      throw new Error('cvm.relays is required when cvm is enabled (array of ws:// URLs)')
    }
    validateRelayUrls(cvmRelays)
    validateLocalRelaysOnly(cvmRelays, 'cvm.relays')

    const serverKey = (env.cvmServerKey as string | undefined) ?? (cvmYaml.serverKey as string | undefined)
    const validatedKey = validatePrivateKey(serverKey)

    const encryptionMode = validateEncryptionMode(
      (env.cvmEncryptionMode as string | undefined) ?? (cvmYaml.encryptionMode as string | undefined)
    )

    const allowedPubkeys = (env.cvmAllowedPubkeys as string[] | undefined)
      ?? toStringArray(cvmYaml.allowedPubkeys)
      ?? []

    const cvmAuthYaml = (cvmYaml.auth ?? {}) as Record<string, unknown>
    const authEnabled = env.cvmAuthEnabled !== undefined
      ? env.cvmAuthEnabled as boolean
      : toBool(cvmAuthYaml.enabled, true)
    const authAllowAny = env.cvmAuthAllowAny !== undefined
      ? env.cvmAuthAllowAny as boolean
      : toBool(cvmAuthYaml.allowAny, false)

    cvmConfig = {
      enabled: true,
      cvmRelays,
      serverKey: validatedKey,
      encryptionMode,
      allowedPubkeys,
      auth: { enabled: authEnabled, allowAny: authAllowAny },
    }
  }

  // --- Ingestion ---
  const ingestRelays = (env.ingestRelays as string[] | undefined)
    ?? toStringArray(yaml.ingestRelays)
    ?? []
  if (ingestRelays.length === 0) {
    throw new Error('ingestRelays is required (array of wss:// URLs)')
  }
  validateRelayUrls(ingestRelays)

  // --- Logging ---
  const logYaml = (yaml.log ?? {}) as Record<string, unknown>
  const logEnabled = env.logEnabled !== undefined
    ? env.logEnabled as boolean
    : toBool(logYaml.enabled, true)
  const logLevel = validateLogLevel(
    (env.logLevel as string | undefined) ?? (logYaml.level as string | undefined)
  )
  const logDestination = validateLogDestination(
    (env.logDestination as string | undefined) ?? (logYaml.destination as string | undefined)
  )
  const logFile = (env.logFile as string | undefined) ?? (logYaml.file as string | undefined)
  if (logDestination === 'file' && !logFile) {
    throw new Error('log.file is required when log.destination is "file"')
  }

  // --- REST Config ---
  const restHost = (env.restHost as string | undefined) ?? (restYaml.host as string | undefined) ?? '127.0.0.1'
  const restPort = env.restPort !== undefined
    ? env.restPort as number
    : toNumber(restYaml.port, 3000)
  const restApiBaseUrl = (env.restApiBaseUrl as string | undefined)
    ?? (restYaml.apiBaseUrl as string | undefined)
    ?? (process.env.NODE_ENV === 'production' ? 'https://api.nostr.watch' : undefined)

  let restCorsOrigins: string[] | '*'
  if (env.restCorsOrigins !== undefined) {
    restCorsOrigins = env.restCorsOrigins as string[] | '*'
  } else if (restYaml.corsOrigins !== undefined) {
    if (restYaml.corsOrigins === '*') {
      restCorsOrigins = '*'
    } else {
      restCorsOrigins = toStringArray(restYaml.corsOrigins) ?? ['http://localhost:3000']
    }
  } else {
    restCorsOrigins = ['http://localhost:3000']
  }

  const restEnableSwagger = env.restEnableSwagger !== undefined
    ? env.restEnableSwagger as boolean
    : toBool(restYaml.enableSwagger, true)
  const restAllowPolicyUpdate = env.restAllowPolicyUpdate !== undefined
    ? env.restAllowPolicyUpdate as boolean
    : toBool(restYaml.allowPolicyUpdate, false)
  const restRateLimitEnabled = env.restRateLimitEnabled !== undefined
    ? env.restRateLimitEnabled as boolean
    : toBool(restRateLimitYaml.enabled, true)
  const restRateLimitRps = env.restRateLimitRps !== undefined
    ? env.restRateLimitRps as number
    : toNumber(restRateLimitYaml.requestsPerSecond, 10)
  const restRateLimitBurst = env.restRateLimitBurst !== undefined
    ? env.restRateLimitBurst as number
    : toNumber(restRateLimitYaml.maxBurst, 100)

  // --- Aggregation ---
  const aggYaml = (yaml.aggregation ?? {}) as Record<string, unknown>
  const aggregation: AggregationPolicy = {
    ...DEFAULT_POLICY,
    quorum: env.aggQuorum !== undefined
      ? env.aggQuorum as number
      : toNumber(aggYaml.quorum, DEFAULT_POLICY.quorum),
    labelQuorum: env.aggLabelQuorum !== undefined
      ? env.aggLabelQuorum as number
      : toNumber(aggYaml.labelQuorum, DEFAULT_POLICY.labelQuorum),
    madScale: env.aggMadScale !== undefined
      ? env.aggMadScale as number
      : toNumber(aggYaml.madScale, DEFAULT_POLICY.madScale),
  }

  // --- Cache ---
  const cacheYaml = (yaml.cache ?? {}) as Record<string, unknown>
  const cacheMaxSize = env.cacheMaxSize !== undefined
    ? env.cacheMaxSize as number
    : toNumber(cacheYaml.maxSize, 10000)
  const cacheTtlSeconds = env.cacheTtlSeconds !== undefined
    ? env.cacheTtlSeconds as number
    : toNumber(cacheYaml.ttlSeconds, 60)

  // --- Publishing ---
  const pubYaml = (yaml.publishing ?? {}) as Record<string, unknown>
  const publishEnabled = env.publishEnabled !== undefined
    ? env.publishEnabled as boolean
    : toBool(pubYaml.enabled, false)

  let publishingConfig: Config['publishing'] | undefined
  if (publishEnabled) {
    const publishRelays = (env.publishRelays as string[] | undefined)
      ?? toStringArray(pubYaml.relays)
      ?? []
    if (publishRelays.length === 0) {
      throw new Error('publishing.relays is required when publishing is enabled')
    }
    validateRelayUrls(publishRelays)
    validateLocalRelaysOnly(publishRelays, 'publishing.relays')

    const signingKey = (env.publishSigningKey as string | undefined)
      ?? (pubYaml.signingKey as string | undefined)
    if (!signingKey || signingKey.trim() === '') {
      throw new Error('PUBLISH_SIGNING_KEY env var is required when publishing is enabled')
    }

    const kind1066Yaml = (pubYaml.kind1066 ?? {}) as Record<string, unknown>
    const kind20066Yaml = (pubYaml.kind20066 ?? {}) as Record<string, unknown>
    const kind1166Yaml = (pubYaml.kind1166 ?? {}) as Record<string, unknown>
    const kind30385Yaml = (pubYaml.kind30385 ?? {}) as Record<string, unknown>
    const announceYaml = (pubYaml.announce ?? {}) as Record<string, unknown>

    const kind1066Enabled = env.publishKind1066Enabled !== undefined
      ? env.publishKind1066Enabled as boolean
      : toBool(kind1066Yaml.enabled, true)
    const kind1066Schedule = validatePublishSchedule(
      (env.publishKind1066Schedule as string | undefined) ?? (kind1066Yaml.schedule as string | undefined)
    )

    const kind20066Enabled = env.publishKind20066Enabled !== undefined
      ? env.publishKind20066Enabled as boolean
      : toBool(kind20066Yaml.enabled, true)

    const kind1166Enabled = env.publishKind1166Enabled !== undefined
      ? env.publishKind1166Enabled as boolean
      : toBool(kind1166Yaml.enabled, true)
    const kind1166Schedule = validatePublishSchedule(
      (env.publishKind1166Schedule as string | undefined) ?? (kind1166Yaml.schedule as string | undefined)
    )

    const kind30385Enabled = env.publishKind30385Enabled !== undefined
      ? env.publishKind30385Enabled as boolean
      : toBool(kind30385Yaml.enabled, false)
    const kind30385Schedule = validatePublishSchedule(
      (env.publishKind30385Schedule as string | undefined) ?? (kind30385Yaml.schedule as string | undefined)
    )
    const kind30385MinObservations = env.publishKind30385MinObservations !== undefined
      ? env.publishKind30385MinObservations as number
      : toNumber(kind30385Yaml.minObservations, 3)
    const kind30385MaterialChangeThreshold = env.publishKind30385MaterialChangeThreshold !== undefined
      ? env.publishKind30385MaterialChangeThreshold as number
      : toNumber(kind30385Yaml.materialChangeThreshold, 0.05)
    const kind30385HistoryRetention = env.publishKind30385HistoryRetention !== undefined
      ? env.publishKind30385HistoryRetention as number
      : toNumber(kind30385Yaml.historyRetention, 86400)
    const kind30385PublishUnreachable = env.publishKind30385PublishUnreachable !== undefined
      ? env.publishKind30385PublishUnreachable as boolean
      : toBool(kind30385Yaml.publishUnreachable, false)

    // Announce config — profile is free-form from YAML, env vars add/override specific keys
    let profile: Record<string, unknown> | undefined = announceYaml.profile != null
      ? { ...(announceYaml.profile as Record<string, unknown>) }
      : undefined

    // Apply env overrides for the three legacy profile env vars
    if (env.publishProfileName !== undefined || env.publishProfileAbout !== undefined || env.publishProfilePicture !== undefined) {
      profile = profile ?? {}
      if (env.publishProfileName !== undefined) profile.name = env.publishProfileName
      if (env.publishProfileAbout !== undefined) profile.about = env.publishProfileAbout
      if (env.publishProfilePicture !== undefined) profile.picture = env.publishProfilePicture
    }

    const announceFrequency = (env.publishFrequency as string | undefined)
      ?? (announceYaml.frequency != null ? String(announceYaml.frequency) : '3600')

    const announceUserDataRelays = (env.publishUserDataRelays as string[] | undefined)
      ?? toStringArray(announceYaml.userDataRelays)

    publishingConfig = {
      enabled: true,
      publishRelays,
      signingKey: signingKey.trim(),
      kind1066: { enabled: kind1066Enabled, schedule: kind1066Schedule },
      kind20066: { enabled: kind20066Enabled },
      kind1166: { enabled: kind1166Enabled, schedule: kind1166Schedule },
      kind30385: {
        enabled: kind30385Enabled,
        schedule: kind30385Schedule,
        minObservations: Math.max(0, Math.floor(kind30385MinObservations)),
        materialChangeThreshold: Math.max(0, kind30385MaterialChangeThreshold),
        historyRetention: Math.max(0, Math.floor(kind30385HistoryRetention)),
        publishUnreachable: kind30385PublishUnreachable,
      },
      announce: {
        profile: profile && Object.keys(profile).length > 0 ? profile : undefined,
        frequency: announceFrequency,
        userDataRelays: announceUserDataRelays && announceUserDataRelays.length > 0
          ? announceUserDataRelays : undefined,
      },
    }
  }

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
        requestsPerSecond: restRateLimitRps,
        maxBurst: restRateLimitBurst,
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
 * Build Config from environment variables only (original behavior, backwards compatible).
 */
function buildConfigFromEnv(): Config {
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
    const kind30385Schedule = validatePublishSchedule(process.env.PUBLISH_KIND30385_SCHEDULE)

    // Announce config
    const announceProfile: Record<string, unknown> = {}
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
      kind30385: {
        enabled: (process.env.PUBLISH_KIND30385_ENABLED ?? 'false').toLowerCase() === 'true',
        schedule: kind30385Schedule,
        minObservations: Math.max(0, Math.floor(parseNumber(process.env.PUBLISH_KIND30385_MIN_OBSERVATIONS, 3))),
        materialChangeThreshold: Math.max(0, parseNumber(process.env.PUBLISH_KIND30385_MATERIAL_CHANGE_THRESHOLD, 0.05)),
        historyRetention: Math.max(0, Math.floor(parseNumber(process.env.PUBLISH_KIND30385_HISTORY_RETENTION, 86400))),
        publishUnreachable: (process.env.PUBLISH_KIND30385_PUBLISH_UNREACHABLE ?? 'false').toLowerCase() === 'true',
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
export function getConfig(configFilePath?: string): Config {
  if (!configInstance) {
    configInstance = loadConfig(configFilePath)
  }
  return configInstance
}

/**
 * Reset config (for testing)
 */
export function resetConfig(): void {
  configInstance = null
  configSource = 'env-only'
}
