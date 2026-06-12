import { Event } from "npm:@nostrwatch/publisher";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import type { TrustedRelayAssertionsConfig } from "../types/config.ts";
import type { GeoResult, RelayCheckResult, RelayInfo } from "../types/relay.ts";
import type {
  PublishedTrustedRelayAssertionState,
  TrustedRelayObservationSample,
  TrustedRelayObservationState,
} from "../db/db.ts";

export type TrustedRelayAssertionStatus =
  | "evaluated"
  | "insufficient_data"
  | "unreachable"
  | "blocked";

export interface TrustedRelayAssertion {
  relayUrl: string;
  status: TrustedRelayAssertionStatus;
  score?: number;
  reliability?: number;
  quality?: number;
  accessibility?: number;
  confidence: "low" | "medium" | "high";
  observations: number;
  observationPeriod: string;
  firstSeen: number;
  algorithm: string;
  algorithmUrl?: string;
  operator?: string;
  operatorVerified?: "nip11";
  operatorConfidence?: number;
  policy?: "open" | "moderated" | "curated" | "specialized";
  policyConfidence?: number;
  countryCode?: string;
  region?: string;
  isHosting?: boolean;
  network?: "clearnet" | "tor" | "i2p";
}

export interface TrustedRelayMaterialChange {
  changed: boolean;
  reason?: string;
}

interface Kind30385Event {
  kind: 30385;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
}

const DEFAULT_ALGORITHM_VERSION = "relaymon-local-v2";
const DEFAULT_ALGORITHM_URL =
  "https://github.com/Letdown2491/trustedrelays/blob/main/ALGORITHM.md";
const ANONYMOUS_NETWORK_COUNTRY_CODE = "XX";
const LOW_SURVEILLANCE_COUNTRIES = new Set([
  "CH",
  "DE",
  "FI",
  "IS",
  "NL",
  "NO",
  "SE",
]);
const MODERATE_SURVEILLANCE_COUNTRIES = new Set([
  "AU",
  "CA",
  "FR",
  "GB",
  "NZ",
  "US",
]);
const HIGH_SURVEILLANCE_COUNTRIES = new Set([
  "CN",
  "IR",
  "KP",
  "RU",
  "SA",
  "TR",
]);
const HIGH_CENSORSHIP_COUNTRIES = new Set([
  "CN",
  "CU",
  "IR",
  "KP",
  "RU",
  "SA",
  "SY",
  "TM",
]);

export function normalizeRelayUrl(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === "wss:" ? "wss:" : "ws:";
  parsed.hash = "";
  const normalized = parsed.toString().toLowerCase();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreLatency(ms: number | undefined): number {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return 50;
  if (ms <= 50) return 100;
  if (ms <= 100) return 95;
  if (ms <= 150) return 90;
  if (ms <= 200) return 85;
  if (ms <= 300) return 75;
  if (ms <= 500) return 60;
  if (ms <= 750) return 40;
  if (ms <= 1000) return 20;
  return 0;
}

function average(total: number, samples: number): number | undefined {
  if (samples <= 0) return undefined;
  return total / samples;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function sampleLatency(
  sample: TrustedRelayObservationSample,
): number | undefined {
  const durations = [
    sample.rttOpen,
    sample.rttRead,
    sample.rttWrite,
  ].filter((value): value is number => {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
  if (!durations.length) return undefined;
  return durations.reduce((total, duration) => total + duration, 0) /
    durations.length;
}

function resultLatency(result: RelayCheckResult): number | undefined {
  const durations = [
    result.open?.duration,
    result.read?.duration,
    result.write?.duration,
  ].filter((value): value is number => {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
  if (!durations.length) return undefined;
  return durations.reduce((total, duration) => total + duration, 0) /
    durations.length;
}

function historySamples(
  history: TrustedRelayObservationState,
): TrustedRelayObservationSample[] {
  return [...(history.history ?? [])].sort((a, b) => {
    if (a.observedAt !== b.observedAt) return a.observedAt - b.observedAt;
    return a.url.localeCompare(b.url);
  });
}

function computeLatencyScore(
  result: RelayCheckResult,
  history: TrustedRelayObservationState,
): number {
  const sampleLatencies = historySamples(history)
    .map(sampleLatency)
    .filter((value): value is number => value !== undefined);

  if (sampleLatencies.length > 0) {
    const mean = sampleLatencies.reduce((total, value) => total + value, 0) /
      sampleLatencies.length;
    return scoreLatency(mean);
  }

  const aggregateLatency = average(
    history.totalRttOpen + history.totalRttRead,
    history.rttOpenSamples + history.rttReadSamples,
  );
  return scoreLatency(aggregateLatency ?? resultLatency(result));
}

function computeConsistencyScore(
  result: RelayCheckResult,
  history: TrustedRelayObservationState,
): number {
  const sampleLatencies = historySamples(history)
    .map(sampleLatency)
    .filter((value): value is number => value !== undefined);
  if (sampleLatencies.length < 3) {
    return scoreLatency(resultLatency(result)) * 0.5 + 50;
  }

  const median = percentile(sampleLatencies, 0.5);
  if (median <= 0) return 75;

  const iqr = percentile(sampleLatencies, 0.75) -
    percentile(sampleLatencies, 0.25);
  const jitterRatio = iqr / median;
  return clampScore(100 - (jitterRatio * 80));
}

function outageSeverityPenalty(length: number): number {
  if (length <= 0) return 0;
  if (length === 1) return 3;
  if (length <= 3) return 8;
  if (length <= 6) return 16;
  if (length <= 12) return 28;
  if (length <= 24) return 45;
  return 65;
}

function computeOutageResilience(
  result: RelayCheckResult,
  history: TrustedRelayObservationState,
): number {
  const samples = historySamples(history);
  if (samples.length === 0) {
    const uptime = history.observations > 0
      ? (history.reachableObservations / history.observations) * 100
      : result.online
      ? 100
      : 0;
    return clampScore(uptime - (result.online ? 0 : 20));
  }

  let outageCount = 0;
  let currentOutageLength = 0;
  let outageSeverity = 0;
  let transitions = 0;
  let previousOnline = samples[0]?.online;

  for (const sample of samples) {
    if (previousOnline !== undefined && sample.online !== previousOnline) {
      transitions += 1;
    }
    previousOnline = sample.online;

    if (!sample.online) {
      currentOutageLength += 1;
      continue;
    }

    if (currentOutageLength > 0) {
      outageCount += 1;
      outageSeverity += outageSeverityPenalty(currentOutageLength);
      currentOutageLength = 0;
    }
  }

  if (currentOutageLength > 0) {
    outageCount += 1;
    outageSeverity += outageSeverityPenalty(currentOutageLength);
  }

  const frequencyPenalty = Math.min(25, outageCount * 3);
  const flappingPenalty = Math.min(20, transitions * 4);
  const currentPenalty = result.online ? 0 : 10;
  return clampScore(
    100 -
      Math.min(65, outageSeverity) -
      frequencyPenalty -
      flappingPenalty -
      currentPenalty,
  );
}

function computeReliability(
  result: RelayCheckResult,
  history: TrustedRelayObservationState,
): number {
  const uptime = history.observations > 0
    ? (history.reachableObservations / history.observations) * 100
    : result.online
    ? 100
    : 0;
  const latencyScore = computeLatencyScore(result, history);
  const consistencyScore = computeConsistencyScore(result, history);
  const outageResilience = computeOutageResilience(result, history);
  const offlinePenalty = result.online ? 0 : 15;

  return clampScore(
    (uptime * 0.35) +
      (outageResilience * 0.25) +
      (consistencyScore * 0.20) +
      (latencyScore * 0.20) -
      offlinePenalty,
  );
}

function scorePolicyClarity(nip11?: RelayInfo): number {
  if (!nip11) return 50;

  let score = 50;
  if (nip11.name && nip11.description) score += 15;
  else if (nip11.name || nip11.description) score += 8;

  if (nip11.contact) score += 15;
  if (nip11.software || nip11.version) score += 5;
  if (nip11.limitation) {
    score += 10;
    if (nip11.limitation.max_message_length !== undefined) score += 1;
    if (nip11.limitation.max_subscriptions !== undefined) score += 1;
    if (nip11.limitation.max_event_tags !== undefined) score += 1;
    if (nip11.limitation.max_content_length !== undefined) score += 1;
  }
  if (nip11.limitation?.payment_required && !nip11.fees) score -= 10;

  let cap = 100;
  if (!(nip11.name || nip11.description)) cap = Math.min(cap, 50);
  if (!nip11.contact) cap = Math.min(cap, 70);
  if (!nip11.limitation) cap = Math.min(cap, 85);

  return clampScore(Math.min(score, cap));
}

function scoreConnectionSecurity(result: RelayCheckResult): number {
  if (result.protocol === "wss:") {
    if (result.ssl?.data?.valid === false) return 75;
    return 100;
  }
  if (result.protocol === "ws:") return 0;
  return 50;
}

function scoreDnsEvidence(result: RelayCheckResult): number {
  if (!result.dns) return 50;
  if (result.dns.error) return 25;

  const data = result.dns.data;
  let score = 60;
  if (
    typeof data.address === "string" ||
    Array.isArray(data.addresses) && data.addresses.length > 0
  ) {
    score += 25;
  }
  if (data.as || data.asn) score += 10;
  return clampScore(score);
}

function scoreOperatorAccountability(nip11?: RelayInfo): number {
  return isHexPubkey(nip11?.pubkey) ? 70 : 50;
}

function computeQuality(result: RelayCheckResult): number {
  const nip11 = result.info?.data;
  const policy = scorePolicyClarity(nip11);
  const security = scoreConnectionSecurity(result);
  const dns = scoreDnsEvidence(result);
  const operator = scoreOperatorAccountability(nip11);
  return clampScore(
    (policy * 0.45) + (security * 0.20) + (dns * 0.20) +
      (operator * 0.15),
  );
}

function scoreAccessBarriers(nip11?: RelayInfo): number {
  if (!nip11) return 70;
  const penalties: number[] = [];
  const limitation = nip11.limitation;
  if (limitation?.payment_required) penalties.push(40);
  if (limitation?.auth_required) penalties.push(30);
  if (
    typeof limitation?.min_pow_difficulty === "number" &&
    limitation.min_pow_difficulty > 0
  ) {
    penalties.push(Math.min(15, limitation.min_pow_difficulty));
  }

  penalties.sort((a, b) => b - a);
  const multipliers = [1, 0.5, 0.3, 0.2];
  const totalPenalty = penalties.reduce((total, penalty, index) => {
    return total +
      (penalty * multipliers[Math.min(index, multipliers.length - 1)]);
  }, 0);

  return clampScore(100 - totalPenalty);
}

function scoreLimitRestrictiveness(nip11?: RelayInfo): number {
  if (!nip11?.limitation) return nip11 ? 100 : 80;
  const limitation = nip11.limitation;
  let score = 100;

  if (
    limitation.max_subscriptions !== undefined &&
    limitation.max_subscriptions < 5
  ) score -= 15;
  else if (
    limitation.max_subscriptions !== undefined &&
    limitation.max_subscriptions < 10
  ) score -= 5;

  if (
    limitation.max_content_length !== undefined &&
    limitation.max_content_length < 1000
  ) score -= 15;
  else if (
    limitation.max_content_length !== undefined &&
    limitation.max_content_length < 5000
  ) score -= 5;

  if (
    limitation.max_message_length !== undefined &&
    limitation.max_message_length < 10000
  ) score -= 10;
  else if (
    limitation.max_message_length !== undefined &&
    limitation.max_message_length < 32000
  ) score -= 3;

  if (limitation.max_filters !== undefined && limitation.max_filters < 5) {
    score -= 10;
  } else if (
    limitation.max_filters !== undefined && limitation.max_filters < 10
  ) score -= 3;

  if (
    limitation.max_event_tags !== undefined && limitation.max_event_tags < 50
  ) score -= 5;

  return clampScore(score);
}

function scoreJurisdiction(
  countryCode: string | undefined,
  network: TrustedRelayAssertion["network"],
): number {
  if (network === "tor" || network === "i2p") return 90;
  if (!countryCode) return 70;
  if (HIGH_CENSORSHIP_COUNTRIES.has(countryCode)) return 25;
  if (LOW_SURVEILLANCE_COUNTRIES.has(countryCode)) return 90;
  if (MODERATE_SURVEILLANCE_COUNTRIES.has(countryCode)) return 70;
  return 75;
}

function scoreSurveillanceRisk(
  countryCode: string | undefined,
  network: TrustedRelayAssertion["network"],
): number {
  if (network === "tor" || network === "i2p") return 90;
  if (!countryCode) return 70;
  if (HIGH_SURVEILLANCE_COUNTRIES.has(countryCode)) return 25;
  if (MODERATE_SURVEILLANCE_COUNTRIES.has(countryCode)) return 60;
  if (LOW_SURVEILLANCE_COUNTRIES.has(countryCode)) return 90;
  return 75;
}

function inferCountryCode(
  result: RelayCheckResult,
  network: TrustedRelayAssertion["network"],
): string | undefined {
  if (network === "tor" || network === "i2p") {
    return ANONYMOUS_NETWORK_COUNTRY_CODE;
  }

  const geo = firstGeo(result.geo?.data);
  if (typeof geo?.countryCode === "string" && geo.countryCode.length > 0) {
    return geo.countryCode.toUpperCase();
  }

  const relayCountries = result.info?.data?.relay_countries;
  const relayCountry = Array.isArray(relayCountries) ? relayCountries[0] : "";
  if (typeof relayCountry === "string" && relayCountry.length > 0) {
    return relayCountry.toUpperCase();
  }

  return undefined;
}

function computeAccessibility(result: RelayCheckResult): number {
  const nip11 = result.info?.data;
  const network = inferNetwork(result, normalizeRelayUrl(result.url));
  const countryCode = inferCountryCode(result, network);
  const countryScore = scoreJurisdiction(countryCode, network);
  const surveillanceScore = scoreSurveillanceRisk(countryCode, network);

  return clampScore(
    (scoreAccessBarriers(nip11) * 0.40) +
      (scoreLimitRestrictiveness(nip11) * 0.20) +
      (countryScore * 0.20) +
      (surveillanceScore * 0.20),
  );
}

function getConfidence(observations: number): "low" | "medium" | "high" {
  if (observations >= 500) return "high";
  if (observations >= 100) return "medium";
  return "low";
}

function observationPeriod(firstSeen: number, lastObserved: number): string {
  const days = Math.floor(Math.max(0, lastObserved - firstSeen) / 86400);
  return days > 0 ? `${days}d` : "<1d";
}

function isHexPubkey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

function firstGeo(
  geo: GeoResult | GeoResult[] | undefined,
): GeoResult | undefined {
  if (Array.isArray(geo)) return geo[0];
  return geo;
}

function inferPolicy(
  result: RelayCheckResult,
): TrustedRelayAssertion["policy"] {
  const info = result.info?.data;
  if (!info) return undefined;

  const supportedNips = Array.isArray(info.supported_nips)
    ? info.supported_nips.map(Number)
    : [];
  if (
    supportedNips.includes(46) &&
    supportedNips.every((nip) => [1, 9, 46].includes(nip))
  ) {
    return "specialized";
  }

  if (
    info.limitation?.restricted_writes ||
    Array.isArray(info.kinds) && info.kinds.length > 0
  ) {
    return "specialized";
  }

  if (info.limitation?.auth_required || info.limitation?.payment_required) {
    return "curated";
  }

  if (
    typeof info.posting_policy === "string" ||
    Array.isArray(info.tags) && info.tags.length > 0
  ) {
    return "moderated";
  }

  return "open";
}

function inferPolicyConfidence(result: RelayCheckResult): number | undefined {
  if (!result.info?.data) return undefined;
  if (
    result.info.data.limitation || result.info.data.posting_policy ||
    result.info.data.tags
  ) return 85;
  return 60;
}

function inferNetwork(
  result: RelayCheckResult,
  relayUrl: string,
): TrustedRelayAssertion["network"] {
  const host = new URL(relayUrl).hostname;
  if (result.network === "tor" || host.endsWith(".onion")) return "tor";
  if (result.network === "i2p" || host.endsWith(".i2p")) return "i2p";
  if (result.network === "clearnet") return "clearnet";
  return undefined;
}

function inferIsHosting(result: RelayCheckResult): boolean | undefined {
  const geo = firstGeo(result.geo?.data);
  const haystack = `${geo?.isp ?? ""} ${geo?.as ?? ""}`.toLowerCase();
  if (!haystack.trim()) return undefined;

  return [
    "hosting",
    "cloud",
    "datacenter",
    "data center",
    "hetzner",
    "ovh",
    "digitalocean",
    "amazon",
    "google",
    "microsoft",
    "linode",
    "vultr",
  ].some((needle) => haystack.includes(needle));
}

export function buildTrustedRelayAssertion(
  result: RelayCheckResult,
  history: TrustedRelayObservationState,
  config: TrustedRelayAssertionsConfig,
): TrustedRelayAssertion {
  const relayUrl = normalizeRelayUrl(result.url);
  const network = inferNetwork(result, relayUrl);
  const reliability = computeReliability(result, history);
  const quality = computeQuality(result);
  const accessibility = computeAccessibility(result);
  const score = clampScore(
    (reliability * 0.40) + (quality * 0.35) + (accessibility * 0.25),
  );
  const minObservations = config.min_observations ?? 10;

  let status: TrustedRelayAssertionStatus;
  if (result.ignore) {
    status = "blocked";
  } else if (!result.online) {
    status = "unreachable";
  } else if (history.observations < minObservations) {
    status = "insufficient_data";
  } else {
    status = "evaluated";
  }

  const assertion: TrustedRelayAssertion = {
    relayUrl,
    status,
    score,
    reliability,
    quality,
    accessibility,
    confidence: getConfidence(history.observations),
    observations: history.observations,
    observationPeriod: observationPeriod(
      history.firstSeen,
      history.lastObserved,
    ),
    firstSeen: history.firstSeen,
    algorithm: config.algorithm?.version ?? DEFAULT_ALGORITHM_VERSION,
    algorithmUrl: config.algorithm?.url ?? DEFAULT_ALGORITHM_URL,
    policy: inferPolicy(result),
    policyConfidence: inferPolicyConfidence(result),
    isHosting: inferIsHosting(result),
    network,
  };

  const info = result.info?.data;
  if (isHexPubkey(info?.pubkey)) {
    assertion.operator = info.pubkey.toLowerCase();
    assertion.operatorVerified = "nip11";
    assertion.operatorConfidence = 70;
  }

  const countryCode = inferCountryCode(result, network);
  if (countryCode) {
    assertion.countryCode = countryCode;
  }
  const geo = firstGeo(result.geo?.data);
  if (
    countryCode !== ANONYMOUS_NETWORK_COUNTRY_CODE &&
    typeof geo?.region === "string" && geo.region.length > 0
  ) {
    assertion.region = geo.region;
  }

  return assertion;
}

export function hasTrustedRelayMaterialChange(
  current: TrustedRelayAssertion,
  previous: PublishedTrustedRelayAssertionState | null,
  threshold = 3,
  refreshIntervalMs = 60 * 60 * 1000,
  now = Math.floor(Date.now() / 1000),
): TrustedRelayMaterialChange {
  if (!previous?.publishedAt) {
    return { changed: true, reason: "first_publish" };
  }

  if (current.status !== previous.status) {
    return {
      changed: true,
      reason: `status_changed:${previous.status}->${current.status}`,
    };
  }

  if (current.confidence !== previous.confidence) {
    return {
      changed: true,
      reason:
        `confidence_changed:${previous.confidence}->${current.confidence}`,
    };
  }

  const scoreFields: Array<
    keyof Pick<
      TrustedRelayAssertion,
      "score" | "reliability" | "quality" | "accessibility"
    >
  > = [
    "score",
    "reliability",
    "quality",
    "accessibility",
  ];
  for (const field of scoreFields) {
    const currentValue = current[field];
    const previousValue = previous[field];
    if (
      currentValue !== undefined && previousValue !== undefined &&
      Math.abs(currentValue - previousValue) >= threshold
    ) {
      return {
        changed: true,
        reason: `${field}_changed:${previousValue}->${currentValue}`,
      };
    }
    if (currentValue !== undefined && previousValue === undefined) {
      return { changed: true, reason: `${field}_appeared` };
    }
  }

  const refreshSeconds = Math.floor(refreshIntervalMs / 1000);
  if (refreshSeconds > 0 && now - previous.publishedAt >= refreshSeconds) {
    return { changed: true, reason: "refresh_interval" };
  }

  return { changed: false };
}

export class Kind30385 extends Event {
  constructor(pubkey: string) {
    super(30385, pubkey);
  }

  private generateTags(assertion: TrustedRelayAssertion): string[][] {
    const tags: string[][] = [
      ["d", assertion.relayUrl],
      ["status", assertion.status],
      ["algorithm", assertion.algorithm],
    ];

    if (assertion.algorithmUrl) {
      tags.push(["algorithm_url", assertion.algorithmUrl]);
    }
    if (assertion.score !== undefined) {
      tags.push(["score", String(assertion.score)]);
    }
    if (assertion.reliability !== undefined) {
      tags.push(["reliability", String(assertion.reliability)]);
    }
    if (assertion.quality !== undefined) {
      tags.push(["quality", String(assertion.quality)]);
    }
    if (assertion.accessibility !== undefined) {
      tags.push(["accessibility", String(assertion.accessibility)]);
    }

    tags.push(["confidence", assertion.confidence]);
    tags.push(["observations", String(assertion.observations)]);
    tags.push(["observation_period", assertion.observationPeriod]);
    tags.push(["first_seen", String(assertion.firstSeen)]);

    if (assertion.operator) tags.push(["operator", assertion.operator]);
    if (assertion.operatorVerified) {
      tags.push(["operator_verified", assertion.operatorVerified]);
    }
    if (assertion.operatorConfidence !== undefined) {
      tags.push(["operator_confidence", String(assertion.operatorConfidence)]);
    }
    if (assertion.policy) tags.push(["policy", assertion.policy]);
    if (assertion.policyConfidence !== undefined) {
      tags.push(["policy_confidence", String(assertion.policyConfidence)]);
    }
    if (assertion.countryCode) {
      tags.push(["country_code", assertion.countryCode]);
    }
    if (assertion.region) tags.push(["region", assertion.region]);
    if (assertion.isHosting !== undefined) {
      tags.push(["is_hosting", String(assertion.isHosting)]);
    }
    if (assertion.network) tags.push(["network", assertion.network]);

    tags.push(["client", "@nostrwatch/relaymon"]);

    return tags;
  }

  protected override _generateEvent(
    assertion: TrustedRelayAssertion,
  ): Kind30385Event {
    return {
      kind: 30385,
      pubkey: this.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: this.generateTags(assertion),
      content: "",
    };
  }

  async generateAndSignEvent(
    assertion: TrustedRelayAssertion,
    privkey: string,
  ): Promise<any> {
    const unsignedEvent = this.generateEvent(assertion);
    return finalizeEvent(unsignedEvent, hexToBytes(privkey));
  }
}
