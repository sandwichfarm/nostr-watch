import type { RelayState } from '../types/aggregation.js'
import { normalizeRelayUrl } from '../../utils/url.js'

export const TRUSTED_RELAY_ASSERTION_KIND = 30385
export const TRUSTED_RELAY_ASSERTION_ALGORITHM = 'rstate-aggregate-v1'

export type TrustAssertionStatus = 'evaluated' | 'insufficient_data' | 'unreachable' | 'blocked'
export type TrustConfidenceLevel = 'low' | 'medium' | 'high'

export interface TrustScoringOptions {
  minObservations: number
  historyRetention: number
  historyEnabled: boolean
  publishUnreachable: boolean
}

export interface TrustListFilters {
  status?: TrustAssertionStatus | TrustAssertionStatus[]
  minScore?: number
  minConfidence?: number
  includeUnreachable?: boolean
  limit?: number
  offset?: number
}

export interface AggregateRelaySnapshot {
  relayUrl: string
  observedAt: number
  reachable: boolean
  rttOpen?: number
  observationCount: number
  monitorCount: number
}

export interface TrustHistorySummary {
  samples: number
  firstSeen?: number
  lastSeen?: number
  uptimeRatio: number
  outageCount: number
  flapCount: number
  periodSeconds: number
}

export interface TrustedRelayAssertion {
  relayUrl: string
  status: TrustAssertionStatus
  algorithm: typeof TRUSTED_RELAY_ASSERTION_ALGORITHM
  generatedAt: number
  score?: number
  reliability: number
  quality: number
  accessibility: number
  confidence: {
    score: number
    level: TrustConfidenceLevel
  }
  observations: number
  monitorCount: number
  observationPeriodSeconds: number
  firstSeen?: number
  lastSeen?: number
  network?: string
  countryCode?: string
  software?: {
    family?: string
    version?: string
  }
  requirements?: Record<string, boolean>
  explanation: {
    reliability: Record<string, number | boolean>
    quality: Record<string, number | boolean>
    accessibility: Record<string, number | boolean | string>
    confidence: Record<string, number>
    history: TrustHistorySummary
  }
}

const DEFAULT_OPTIONS: TrustScoringOptions = {
  minObservations: 3,
  historyRetention: 24 * 3600,
  historyEnabled: false,
  publishUnreachable: false,
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function roundScore(value: number): number {
  return Math.round(clamp(value))
}

function weighted(parts: Array<[number, number]>): number {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0)
  if (totalWeight <= 0) return 0
  return parts.reduce((sum, [value, weight]) => sum + clamp(value) * weight, 0) / totalWeight
}

function avg(values: number[], fallback: number): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback
}

function relayReachable(state: RelayState): boolean {
  if (state.rtt?.open?.value === undefined || state.lastOpenAt === undefined) return false
  if (state.lastSeenAt === undefined) return true
  return state.lastOpenAt >= state.lastSeenAt
}

function latencyScore(rttOpen?: number): number {
  if (rttOpen === undefined) return 50
  if (rttOpen <= 250) return 100
  if (rttOpen >= 3000) return 20
  return 100 - ((rttOpen - 250) / 2750) * 80
}

function recencyScore(lastSeenAt: number | undefined, now: number): number {
  if (!lastSeenAt) return 0
  const age = Math.max(0, now - lastSeenAt)
  if (age <= 3600) return 100
  if (age >= 7 * 24 * 3600) return 0
  if (age <= 24 * 3600) return 100 - ((age - 3600) / (23 * 3600)) * 50
  return 50 - ((age - 24 * 3600) / (6 * 24 * 3600)) * 50
}

function confidenceLevel(score: number): TrustConfidenceLevel {
  if (score >= 75) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function supportAverage(state: RelayState): number {
  const supports: number[] = []
  if (state.network?.support !== undefined) supports.push(state.network.support * 100)
  if (state.software?.family?.support !== undefined) supports.push(state.software.family.support * 100)
  if (state.software?.version?.support !== undefined) supports.push(state.software.version.support * 100)
  if (state.rtt?.open?.support !== undefined) supports.push(state.rtt.open.support * 100)
  if (state.rtt?.read?.support !== undefined) supports.push(state.rtt.read.support * 100)
  if (state.rtt?.write?.support !== undefined) supports.push(state.rtt.write.support * 100)
  if (state.nips?.support) {
    for (const value of Object.values(state.nips.support)) supports.push(value * 100)
  }
  if (state.requirements) {
    for (const requirement of Object.values(state.requirements)) supports.push(requirement.support * 100)
  }
  if (state.country?.support !== undefined) supports.push(state.country.support * 100)
  if (state.geo?.support !== undefined) supports.push(state.geo.support * 100)
  return avg(supports, 50)
}

function nipScore(state: RelayState): number {
  const nips = new Set(state.nips?.list ?? [])
  const breadthScore = clamp((nips.size / 20) * 100)
  const coreNips = [1, 9, 11, 12, 15, 16, 20, 22, 33, 40]
  const coreScore = (coreNips.filter((nip) => nips.has(nip)).length / coreNips.length) * 100
  return weighted([[breadthScore, 0.45], [coreScore, 0.55]])
}

function nip11ConsistencyScore(state: RelayState): number {
  const nip11 = state.nip11
  if (!nip11) return 50

  const checks: number[] = []
  const nip11Nips = Array.isArray(nip11.supported_nips)
    ? new Set(nip11.supported_nips.filter((nip: unknown): nip is number => typeof nip === 'number'))
    : undefined
  const aggregateNips = new Set(state.nips?.list ?? [])
  if (nip11Nips && aggregateNips.size > 0) {
    const intersection = [...aggregateNips].filter((nip) => nip11Nips.has(nip)).length
    const union = new Set([...aggregateNips, ...nip11Nips]).size
    checks.push(union > 0 ? (intersection / union) * 100 : 50)
  }

  if (typeof nip11.software === 'string' && state.software?.family?.value) {
    checks.push(nip11.software.toLowerCase().includes(state.software.family.value.toLowerCase()) ? 100 : 60)
  }

  if (typeof nip11.version === 'string' && state.software?.version?.value) {
    checks.push(nip11.version === state.software.version.value ? 100 : 75)
  }

  return avg(checks, 75)
}

function requirementValues(state: RelayState): Record<string, boolean> {
  const values: Record<string, boolean> = {}
  for (const [key, aggregate] of Object.entries(state.requirements ?? {})) {
    values[key] = aggregate.value
  }
  return values
}

function barrierScore(requirements: Record<string, boolean>): number {
  let score = 100
  if (requirements.auth) score -= 20
  if (requirements.payment) score -= 20
  if (requirements.pow) score -= 20
  return clamp(score)
}

function transportScore(state: RelayState): number {
  const checks = [
    state.rtt?.open?.value,
    state.rtt?.read?.value,
    state.rtt?.write?.value,
    state.rtt?.info?.value,
  ]
  const present = checks.filter((value) => value !== undefined).length
  return (present / checks.length) * 100
}

function networkScore(network: string | undefined): number {
  if (network === 'clearnet') return 100
  if (network === 'hybrid') return 85
  if (network === 'tor' || network === 'i2p') return 70
  return 50
}

export class AggregateSnapshotStore {
  private snapshots = new Map<string, AggregateRelaySnapshot[]>()
  private enabled: boolean
  private retentionSeconds: number

  constructor(options: Pick<TrustScoringOptions, 'historyEnabled' | 'historyRetention'> = DEFAULT_OPTIONS) {
    this.enabled = options.historyEnabled
    this.retentionSeconds = options.historyRetention
  }

  configure(options: Pick<TrustScoringOptions, 'historyEnabled' | 'historyRetention'>): void {
    this.enabled = options.historyEnabled
    this.retentionSeconds = options.historyRetention
    if (!this.enabled) this.snapshots.clear()
  }

  recordCycle(states: RelayState[], now: number = Math.floor(Date.now() / 1000)): void {
    if (!this.enabled) return
    const cutoff = now - this.retentionSeconds
    for (const state of states) {
      const relayUrl = normalizeRelayUrl(state.relayUrl)
      const snapshots = this.snapshots.get(relayUrl) ?? []
      snapshots.push({
        relayUrl,
        observedAt: now,
        reachable: relayReachable(state),
        rttOpen: state.rtt?.open?.value,
        observationCount: state.observationCount,
        monitorCount: state.contributingAuthors.length,
      })
      this.snapshots.set(relayUrl, snapshots.filter((snapshot) => snapshot.observedAt >= cutoff))
    }
    this.evict(now)
  }

  get(relayUrl: string): AggregateRelaySnapshot[] {
    return [...(this.snapshots.get(normalizeRelayUrl(relayUrl)) ?? [])]
  }

  summarize(relayUrl: string, fallbackFirstSeen?: number, fallbackLastSeen?: number): TrustHistorySummary {
    const snapshots = this.get(relayUrl)
    if (snapshots.length === 0) {
      return {
        samples: 0,
        firstSeen: fallbackFirstSeen,
        lastSeen: fallbackLastSeen,
        uptimeRatio: 0,
        outageCount: 0,
        flapCount: 0,
        periodSeconds: 0,
      }
    }

    const firstSeen = snapshots[0].observedAt
    const lastSeen = snapshots[snapshots.length - 1].observedAt
    let outageCount = 0
    let flapCount = 0
    for (let index = 1; index < snapshots.length; index++) {
      const previous = snapshots[index - 1]
      const current = snapshots[index]
      if (previous.reachable !== current.reachable) {
        flapCount++
        if (!current.reachable) outageCount++
      }
    }

    return {
      samples: snapshots.length,
      firstSeen,
      lastSeen,
      uptimeRatio: snapshots.filter((snapshot) => snapshot.reachable).length / snapshots.length,
      outageCount,
      flapCount,
      periodSeconds: Math.max(0, lastSeen - firstSeen),
    }
  }

  count(relayUrl?: string): number {
    if (relayUrl) return this.get(relayUrl).length
    let total = 0
    for (const snapshots of this.snapshots.values()) total += snapshots.length
    return total
  }

  private evict(now: number): void {
    const cutoff = now - this.retentionSeconds
    for (const [relayUrl, snapshots] of this.snapshots.entries()) {
      const retained = snapshots.filter((snapshot) => snapshot.observedAt >= cutoff)
      if (retained.length === 0) this.snapshots.delete(relayUrl)
      else this.snapshots.set(relayUrl, retained)
    }
  }
}

export class TrustedRelayAssertionService {
  private options: TrustScoringOptions
  private history: AggregateSnapshotStore

  constructor(options: Partial<TrustScoringOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.history = new AggregateSnapshotStore(this.options)
  }

  configure(options: Partial<TrustScoringOptions>): void {
    this.options = { ...this.options, ...options }
    this.history.configure(this.options)
  }

  recordAggregateCycle(states: RelayState[], now: number = Math.floor(Date.now() / 1000)): void {
    this.history.recordCycle(states, now)
  }

  getHistoryCount(relayUrl?: string): number {
    return this.history.count(relayUrl)
  }

  trust(state: RelayState, now: number = Math.floor(Date.now() / 1000)): TrustedRelayAssertion {
    const relayUrl = normalizeRelayUrl(state.relayUrl)
    const history = this.history.summarize(relayUrl, state.lastSeenAt, state.lastSeenAt)
    const reachable = relayReachable(state)
    const requirements = requirementValues(state)

    const historyUptime = history.samples > 0 ? history.uptimeRatio : (reachable ? 1 : 0)
    const flapRate = history.samples > 1 ? history.flapCount / (history.samples - 1) : 0
    const outageScore = clamp(100 - history.outageCount * 15 - flapRate * 50)
    const currentReachabilityScore = reachable ? 100 : 0
    const latency = latencyScore(state.rtt?.open?.value)
    const reliability = roundScore(weighted([
      [currentReachabilityScore, 0.35],
      [historyUptime * 100, 0.35],
      [outageScore, 0.15],
      [latency, 0.15],
    ]))

    const nipSupportScore = nipScore(state)
    const consistency = nip11ConsistencyScore(state)
    const softwareCompleteness = state.software?.family?.value ? (state.software.version?.value ? 100 : 75) : 40
    const requirementTransparency = state.requirements
      ? avg(Object.values(state.requirements).map((requirement) => requirement.support * 100), 70)
      : 50
    const quality = roundScore(weighted([
      [nipSupportScore, 0.4],
      [consistency, 0.25],
      [softwareCompleteness, 0.2],
      [requirementTransparency, 0.15],
    ]))

    const accessNetworkScore = networkScore(state.network?.value)
    const accessTransportScore = transportScore(state)
    const geoScore = state.country?.value ? 100 : (state.geo ? 80 : 50)
    const accessBarrierScore = barrierScore(requirements)
    const accessibility = roundScore(weighted([
      [accessNetworkScore, 0.25],
      [accessTransportScore, 0.25],
      [geoScore, 0.2],
      [accessBarrierScore, 0.3],
    ]))

    const observationScore = clamp((state.observationCount / 500) * 100)
    const diversityScore = clamp((state.contributingAuthors.length / 5) * 100)
    const recent = recencyScore(state.lastSeenAt ?? state.updated_at, now)
    const consistencyScore = supportAverage(state)
    const confidenceScore = roundScore(weighted([
      [observationScore, 0.35],
      [diversityScore, 0.3],
      [recent, 0.2],
      [consistencyScore, 0.15],
    ]))

    let status: TrustAssertionStatus = 'evaluated'
    if (state.observationCount < this.options.minObservations) status = 'insufficient_data'
    else if (!reachable) status = 'unreachable'

    const score = status === 'evaluated'
      ? roundScore(weighted([[reliability, 0.4], [quality, 0.35], [accessibility, 0.25]]))
      : undefined

    return {
      relayUrl,
      status,
      algorithm: TRUSTED_RELAY_ASSERTION_ALGORITHM,
      generatedAt: now,
      score,
      reliability,
      quality,
      accessibility,
      confidence: {
        score: confidenceScore,
        level: confidenceLevel(confidenceScore),
      },
      observations: state.observationCount,
      monitorCount: state.contributingAuthors.length,
      observationPeriodSeconds: history.periodSeconds || this.options.historyRetention,
      firstSeen: history.firstSeen ?? state.lastSeenAt,
      lastSeen: history.lastSeen ?? state.lastSeenAt,
      network: state.network?.value,
      countryCode: state.country?.value,
      software: {
        family: state.software?.family?.value,
        version: state.software?.version?.value,
      },
      requirements,
      explanation: {
        reliability: {
          reachable,
          currentReachabilityScore,
          uptimeRatio: historyUptime,
          outageScore,
          outageCount: history.outageCount,
          flapCount: history.flapCount,
          latencyScore: latency,
        },
        quality: {
          nipSupportScore,
          nip11ConsistencyScore: consistency,
          softwareCompleteness,
          requirementTransparency,
        },
        accessibility: {
          network: state.network?.value ?? 'unknown',
          networkScore: accessNetworkScore,
          transportScore: accessTransportScore,
          geoScore,
          barrierScore: accessBarrierScore,
          authRequired: !!requirements.auth,
          paymentRequired: !!requirements.payment,
          powRequired: !!requirements.pow,
        },
        confidence: {
          observationScore,
          diversityScore,
          recencyScore: recent,
          consistencyScore,
        },
        history,
      },
    }
  }

  trustList(states: RelayState[], filters: TrustListFilters = {}, now: number = Math.floor(Date.now() / 1000)): TrustedRelayAssertion[] {
    let assertions = states.map((state) => this.trust(state, now))

    const includeUnreachable = filters.includeUnreachable ?? true
    if (!includeUnreachable) {
      assertions = assertions.filter((assertion) => assertion.status !== 'unreachable')
    }

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      assertions = assertions.filter((assertion) => statuses.includes(assertion.status))
    }

    if (filters.minScore !== undefined) {
      assertions = assertions.filter((assertion) => (assertion.score ?? 0) >= filters.minScore!)
    }

    if (filters.minConfidence !== undefined) {
      assertions = assertions.filter((assertion) => assertion.confidence.score >= filters.minConfidence!)
    }

    assertions.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.relayUrl.localeCompare(b.relayUrl))

    const offset = filters.offset ?? 0
    const limit = filters.limit ?? assertions.length
    return assertions.slice(offset, offset + limit)
  }
}
