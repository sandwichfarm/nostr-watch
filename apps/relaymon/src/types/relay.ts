/**
 * Strong Type Definitions for Relay Check Results
 *
 * Provides compile-time type safety for relay check results from Nocap
 * and post-deduplication processing.
 */

import type { NetworkType } from "./config.ts";

/**
 * Generic check result structure
 */
export interface CheckResult<T> {
  data: T;
  duration: number;
  error?: Error;
}

/**
 * NIP-11 relay information document
 * See: https://github.com/nostr-protocol/nips/blob/master/11.md
 */
export interface RelayInfo {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  supported_nips?: number[];
  software?: string;
  version?: string;
  limitation?: {
    max_message_length?: number;
    max_subscriptions?: number;
    max_filters?: number;
    max_limit?: number;
    max_subid_length?: number;
    max_event_tags?: number;
    max_content_length?: number;
    min_pow_difficulty?: number;
    auth_required?: boolean;
    payment_required?: boolean;
    restricted_writes?: boolean;
  };
  relay_countries?: string[];
  language_tags?: string[];
  tags?: string[];
  posting_policy?: string;
  payments_url?: string;
  fees?: {
    admission?: { amount: number; unit: string }[];
    subscription?: { amount: number; unit: string; period: number }[];
    publication?: { amount: number; unit: string }[];
  };
  [key: string]: unknown; // Allow other fields
}

/**
 * DNS lookup result
 */
export interface DnsResult {
  address?: string;
  addresses?: string[];
  asn?: string | number;  // Autonomous System Number
  as?: string;            // Autonomous System name
  [key: string]: unknown;
}

/**
 * Geographic location result
 */
export interface GeoResult {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  asn?: string | number;  // Autonomous System Number
  as?: string;            // Autonomous System name
  geohash?: string;       // NIP-52 geohash
  [key: string]: unknown;
}

/**
 * SSL/TLS certificate result
 */
export interface SslResult {
  valid?: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  [key: string]: unknown;
}

/**
 * Raw result from Nocap check (before deduplication)
 */
export interface NocapCheckResult {
  url: string;
  hostname?: string;
  protocol?: string;
  checked_at?: number;
  open?: CheckResult<boolean>;
  read?: CheckResult<boolean>;
  write?: CheckResult<boolean>;
  info?: CheckResult<RelayInfo>;
  dns?: CheckResult<DnsResult>;
  geo?: CheckResult<GeoResult>;
  ssl?: CheckResult<SslResult>;
}

/**
 * Result after deduplication processing
 * Includes additional metadata fields
 */
export interface RelayCheckResult extends NocapCheckResult {
  hostname: string;
  protocol: string;
  checked_at: number;
  online: boolean;
  ignore: boolean;
  ignore_reason?: string;
  parent: string;
  network: NetworkType;
}

/**
 * Type guard to check if a result is a valid NocapCheckResult
 */
export function isNocapCheckResult(result: unknown): result is NocapCheckResult {
  if (!result || typeof result !== "object") {
    return false;
  }

  const r = result as Record<string, unknown>;

  // Must have url
  if (typeof r.url !== "string" || !r.url) {
    return false;
  }

  // If check results exist, they must have the correct shape
  const checkFields = ["open", "read", "write", "info", "dns", "geo", "ssl"];
  for (const field of checkFields) {
    if (r[field] !== undefined) {
      const check = r[field] as Record<string, unknown>;
      if (!check || typeof check !== "object") {
        return false;
      }
      // Must have data and duration
      if (check.data === undefined || typeof check.duration !== "number") {
        return false;
      }
    }
  }

  return true;
}

/**
 * Type guard to check if a result is a fully-processed RelayCheckResult
 */
export function isRelayCheckResult(result: unknown): result is RelayCheckResult {
  if (!isNocapCheckResult(result)) {
    return false;
  }

  const r = result as unknown as Record<string, unknown>;

  // Must have all required fields
  if (typeof r.hostname !== "string") return false;
  if (typeof r.protocol !== "string") return false;
  if (typeof r.checked_at !== "number") return false;
  if (typeof r.online !== "boolean") return false;
  if (typeof r.ignore !== "boolean") return false;
  if (typeof r.parent !== "string") return false;
  if (typeof r.network !== "string") return false;

  // network must be a valid NetworkType
  const validNetworks = ["clearnet", "tor", "i2p", "lokinet"];
  if (!validNetworks.includes(r.network as string)) return false;

  return true;
}

/**
 * Helper to extract online status from a check result
 */
export function isRelayOnline(result: NocapCheckResult | RelayCheckResult): boolean {
  // If it's a RelayCheckResult, use the online field
  if ("online" in result && typeof result.online === "boolean") {
    return result.online;
  }

  // Otherwise, check the open.data field
  return result.open?.data === true;
}

/**
 * Helper to extract check duration total
 */
export function getTotalDuration(result: NocapCheckResult): number {
  let total = 0;
  if (result.open?.duration) total += result.open.duration;
  if (result.read?.duration) total += result.read.duration;
  if (result.write?.duration) total += result.write.duration;
  if (result.info?.duration) total += result.info.duration;
  if (result.dns?.duration) total += result.dns.duration;
  if (result.geo?.duration) total += result.geo.duration;
  if (result.ssl?.duration) total += result.ssl.duration;
  return total;
}
