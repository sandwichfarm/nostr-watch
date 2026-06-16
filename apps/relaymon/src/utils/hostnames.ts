// hostnames.ts
import { getLogger, LogLevel } from "./logger.ts";
import { normalizeURL } from "npm:nostr-tools/utils";
import hash from "npm:object-hash";
import { db, getOnlineRelays, getRelayInfo, storeRelayInfo, getRelaysWithSameInfo, getRelaysByHostname } from "../db/db.ts";
import { deleteRelayCheckEvent } from "./deletion.ts";
import type { Config } from "../config/config.ts";
import type { RelayCheckResult, RelayInfo } from "../types/relay.ts";
import { getErrorMessage } from "../types/errors.ts";
import { normalizeNip11 } from "./nip11.ts";

// Force console output for debugging

// Initialize logger with specific log level set
const logger = getLogger("Hostnames");

// Global variable to store the application config
let appConfig: Config | null = null;

/**
 * Set the application config for use in deletion
 * @param config The application config
 */
export function setConfig(config: Config): void {
  appConfig = config;
}


/**
 * Phase 20 PERF: local timestring → ms converter for consumer-side lazy
 * conversion of DeduplicationConfig.nip11_stale_skip. Mirrors the shape of
 * parseInterval() in apps/relaymon/src/core/daemon.ts (which is a private
 * helper there). Kept local to hostnames.ts so the integration does not
 * reach across the core/utils boundary. Returns NaN on parse failure so
 * callers can fall through to a numeric default.
 */
function parseStaleSkipTimestring(interval: string): number {
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) return NaN;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return NaN;
  }
}

// Define IgnoreListSync interface for type safety
interface IgnoreListSyncInterface {
  isIgnored(url: string): boolean;
  addToIgnoreList(url: string, reason?: string): void;
}

// Import IgnoreListSync type (will be set via setIgnoreListSync function)
let ignoreListSyncInstance: IgnoreListSyncInterface | null = null;

/**
 * Set the IgnoreListSync instance for use in deduplication
 * @param ignoreListSync The IgnoreListSync instance
 */
export function setIgnoreListSync(ignoreListSync: IgnoreListSyncInterface): void {
  ignoreListSyncInstance = ignoreListSync;
}

/**
 * Groups an array of URLs by their protocol+hostname.
 * Returns a map where the key is "<protocol>//<hostname>" and the value is an array of URLs.
 */
export const relayArrToHostnameProtocolKeyedMap = (urls: string[]): Map<string, string[]> => {
  const urlMap = new Map<string, string[]>();
  const ordered = new Map<string, string[]>();

  urls.forEach((url) => {
    try {
      const parsedUrl = new URL(url);
      const protocolAndHostname = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
      if (!urlMap.has(protocolAndHostname)) {
        urlMap.set(protocolAndHostname, []);
      }
      urlMap.get(protocolAndHostname)?.push(url);
    } catch (error) {
      logger.error(`Invalid URL: ${url}`);
    }
  });

  urlMap.forEach((urls, protocolAndHostname) => {
    urls.sort((a, b) => {
      const pathDepthA = new URL(a).pathname.split("/").filter(Boolean).length;
      const pathDepthB = new URL(b).pathname.split("/").filter(Boolean).length;
      if (pathDepthA === pathDepthB) {
        return a.length - b.length;
      }
      return pathDepthA - pathDepthB;
    });
    ordered.set(protocolAndHostname, urls);
  });

  return ordered;
};

/**
 * Deduplicates an array of relay results by hostname.
 */
export const relayListHostnameDedup = async (relays: RelayCheckResult[]): Promise<RelayCheckResult[]> => {
  const maybeModifiedRelays: RelayCheckResult[] = [];
  for (const relay of relays) {
    maybeModifiedRelays.push(await relayHostnameDedup(relay));
  }
  return maybeModifiedRelays;
};

function isRootUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname === "/" || parsedUrl.pathname === "";
  } catch (e) {
    return false;
  }
}

/**
 * Safely creates a hash from NIP-11 info data, normalizing it to ensure consistent comparison
 */
export function createInfoHash(infoData: RelayInfo | Record<string, unknown> | null | undefined): string {
  if (!infoData || typeof infoData !== 'object' || Object.keys(infoData).length === 0) {
    return "";  // Return empty string instead of null for type safety
  }

  try {
    // Phase 18 Fix 2: strip volatile NIP-11 fields BEFORE sorting/hashing.
    // Phase 17 Hypothesis B confirmed that volatile fields (timestamps,
    // counters, last_*, current_*) cause the same server to produce
    // different hashes across check cycles, defeating case1/case2/case8.
    const stripped = normalizeNip11(infoData as Record<string, unknown>);

    // After stripping, the object may be empty (e.g., if every field was
    // volatile). In that case return "" to match the early-return contract
    // above and avoid a universal "empty-normalized" hash collision.
    if (Object.keys(stripped).length === 0) {
      return "";
    }

    // Sort the keys to ensure consistent hashing regardless of object property order
    const normalized: Record<string, unknown> = {};
    Object.keys(stripped).sort().forEach(key => {
      normalized[key] = stripped[key];
    });
    return `RelayCheckInfo@${hash(normalized)}`;
  } catch (e) {
    logger.error(`Error creating info hash: ${e}`);
    return "";  // Return empty string on error
  }
}

/** Accepted for caller back-compat; unused by the current dynamic dedup. */
export interface DedupContext {
  onlineUrls?: string[];
}

/**
 * Dynamic hostname deduplication for a relay check result. No hardcoded
 * host/path lists.
 *
 * 1. Relays on different hostnames serving identical NIP-11 collapse to the
 *    shortest/root form.
 * 2. Within a hostname the canonical is the root ("/"), else the shortest
 *    sibling. The family is drawn from ALL known siblings (online and offline)
 *    so an offline or unseeded root still wins.
 * 3. A path is kept only when its NIP-11 proves different functionality from
 *    the canonical; with no NIP-11, or NIP-11 equal to the canonical, it is
 *    ignored with parent = canonical. This drops path spam while preserving
 *    genuinely distinct path relays (e.g. lang.relays.land/en).
 *
 * NIP-11 is read only for the canonical (and the URL under check): O(family),
 * not O(online).
 */
export const relayHostnameDedup = async (
  result: RelayCheckResult,
  ctx?: DedupContext,
): Promise<RelayCheckResult> => {
  // Force direct console output at the start of function

  const { url: mURL, hostname: HOSTNAME, protocol: PROTOCOL } = result;

  logger.debug(`HOSTNAME: ${HOSTNAME}`);
  try {
    if (!mURL || !HOSTNAME || !PROTOCOL) {
      throw new Error(`Invalid result object: ${JSON.stringify(result)}`);
    }

    // Phase 18 Fix 3: canonicalize mURL at function entry so all
    // downstream URL comparisons happen in canonical form. normalizeURL
    // (from nostr-tools/utils) strips trailing slashes from path URLs,
    // which would otherwise cause orderedFamily.indexOf(mURL) to return
    // -1 for URLs like "wss://haven.nostrfreedom.net/inbox/" — triggering
    // the CRITICAL ERROR branch and wrongly ignoring legit path-only relays.
    let canonicalMURL: string;
    try {
      canonicalMURL = normalizeURL(mURL);
    } catch {
      canonicalMURL = mURL;
    }

    // NOTE: local dedup logic is authoritative. The synced ignore list
    // from other monitors is NOT consulted here — a previous version of
    // this code early-returned ignore=true/parent="" whenever a URL
    // appeared in the synced list, which (a) wiped legitimate parent
    // pointers computed by local logic and (b) propagated poisoned
    // decisions from other monitors (including roots wrongly flipped by
    // pre-Phase-18 bugs) back onto the local DB. Local dedup MUST run
    // to completion on every URL, regardless of what peers believe.
    // The synced list is still populated via addToIgnoreList calls
    // downstream and remains useful to higher layers as an advisory
    // cross-monitor signal, but it is never an override.

    // First, check if this relay has NIP-11 info and store it if available
    const currentHasNip11Info = result?.info?.data && Object.keys(result.info.data).length > 0;
    if (currentHasNip11Info) {
      const currentInfoHash = createInfoHash(result.info.data);
      if (currentInfoHash) {
        // Store the NIP-11 info in our new table
        storeRelayInfo(mURL, result.info.data, currentInfoHash);
        logger.debug(`Stored NIP-11 info for ${mURL} with hash ${currentInfoHash}`);
        
        // Check if other relays have the exact same NIP-11 info
        const relaysWithSameInfo = getRelaysWithSameInfo(currentInfoHash);
        logger.debug(`Found ${relaysWithSameInfo.length} relays with same NIP-11 info as ${mURL}`);
        
        if (relaysWithSameInfo.length > 0) {
          // If there are other relays with the exact same NIP-11 info, and this relay isn't a root URL,
          // we should mark it as a duplicate
          if (!isRootUrl(mURL)) {
            // Find root URLs among relays with the same info
            const rootURLs = relaysWithSameInfo.filter(relay => isRootUrl(relay));
            
            if (rootURLs.length > 0) {
              // Mark as duplicate of the first root URL
              result.ignore = true;
              result.parent = rootURLs[0];
              logger.debug(`Ignoring ${mURL} - has same NIP-11 info as root URL ${rootURLs[0]}`);

              // Phase 21 (item 5): use canonicalMURL (not raw mURL) in addToIgnoreList/
              // deleteRelayCheckEvent calls — unifies with the Phase 20 override deny path
              // which also uses canonicalMURL. Both resolve to the same DB row via
              // normalizeURL on-read in libraries/db, but canonicalMURL is the form that
              // participates in all downstream comparisons (orderedFamily, hostnameFamily
              // filter). Defensive-deny branch (lines ~414, 417) remains raw mURL — that is
              // Phase 18 Fix 1 code, out of scope for Phase 21.
              const nip11RootReason = `Relay has same NIP-11 info as root URL ${rootURLs[0]}`;
              if (ignoreListSyncInstance) {
                ignoreListSyncInstance.addToIgnoreList(canonicalMURL, nip11RootReason);
              }

              // Generate deletion event for this ignored relay
              if (appConfig) {
                await deleteRelayCheckEvent(canonicalMURL, nip11RootReason, appConfig);
              }

              return result;
            }

            // If no root URLs, use the shortest URL
            relaysWithSameInfo.sort((a, b) => a.length - b.length);
            if (relaysWithSameInfo[0] !== mURL) {
              result.ignore = true;
              result.parent = relaysWithSameInfo[0];
              logger.debug(`Ignoring ${mURL} - has same NIP-11 info as ${relaysWithSameInfo[0]}`);

              const nip11ShorterReason = `Relay has same NIP-11 info as shorter URL ${relaysWithSameInfo[0]}`;
              if (ignoreListSyncInstance) {
                ignoreListSyncInstance.addToIgnoreList(canonicalMURL, nip11ShorterReason);
              }

              // Generate deletion event for this ignored relay
              if (appConfig) {
                await deleteRelayCheckEvent(canonicalMURL, nip11ShorterReason, appConfig);
              }

              return result;
            }
          }
        }
      }
    }

    // Within-hostname dedup (see function doc). The root is the canonical and
    // is never ignored here.
    if (isRootUrl(canonicalMURL)) {
      result.ignore = false;
      result.parent = "";
      logger.debug(`${mURL} is the root URL for ${HOSTNAME} — canonical, never ignored`);
      return result;
    }

    let siblings: string[];
    try {
      siblings = getRelaysByHostname(HOSTNAME, PROTOCOL);
    } catch (e) {
      logger.error(`getRelaysByHostname failed for ${HOSTNAME}: ${getErrorMessage(e)}`);
      siblings = [];
    }
    const family = siblings.filter((u) => u !== canonicalMURL);

    if (family.length === 0) {
      // No known sibling on this hostname to dedupe against → keep.
      result.ignore = false;
      result.parent = "";
      logger.debug(`No known siblings for ${mURL} on ${HOSTNAME} — keeping`);
      return result;
    }

    // Root sibling wins, else shortest. Self is included so a shorter self is
    // never ignored in favour of a longer sibling.
    const ranked = [...family, canonicalMURL].sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const canonical = ranked.find((u) => isRootUrl(u)) ?? ranked[0];

    if (canonical === canonicalMURL) {
      // Self is the canonical (shortest known form, no root sibling) → keep.
      result.ignore = false;
      result.parent = "";
      logger.debug(`${mURL} is the canonical (shortest) for ${HOSTNAME} — keeping`);
      return result;
    }

    // Canonical reads NIP-11 from stored relay_info so an offline canonical
    // still contributes its last-known fingerprint.
    const selfInfo =
      (result?.info?.data && Object.keys(result.info.data).length > 0)
        ? result.info.data
        : (getRelayInfo(canonicalMURL)?.info ?? null);
    const selfHash = createInfoHash(selfInfo);
    const canonicalHash = createInfoHash(getRelayInfo(canonical)?.info ?? null);

    // Distinct only if the path has its own NIP-11 that differs from the
    // canonical. Caveat: if the canonical has no fingerprint but the path does,
    // we keep the path (cannot assert they are the same relay). No NIP-11 at
    // all always loses to the canonical.
    const provesDistinctFunctionality =
      selfHash !== "" && (canonicalHash === "" || selfHash !== canonicalHash);

    logger.debug(
      `Dynamic dedup ${mURL}: canonical=${canonical} selfHash=${selfHash || "none"} canonicalHash=${canonicalHash || "none"} distinct=${provesDistinctFunctionality}`,
    );

    if (provesDistinctFunctionality) {
      result.ignore = false;
      result.parent = "";
      logger.debug(`${mURL} has distinct NIP-11 from canonical ${canonical} — kept as a distinct relay`);
      return result;
    }

    // Canonical wins.
    result.ignore = true;
    result.parent = canonical;
    const reason = selfHash === ""
      ? `No NIP-11 to prove distinct functionality from canonical ${canonical}`
      : `Same NIP-11 functionality as canonical ${canonical}`;
    logger.warn(`${mURL} | Ignored because: ${reason}`);
    if (ignoreListSyncInstance) {
      ignoreListSyncInstance.addToIgnoreList(canonicalMURL, reason);
    }
    if (appConfig) {
      await deleteRelayCheckEvent(canonicalMURL, reason, appConfig);
    }
    return result;
  } catch (error) {
    logger.error(`Error in relayHostnameDedup: ${error}`);
  }
  return result;
};

/**
 * Re-evaluate deduplication for all online relays in the database
 * This should be run periodically to catch relays that were checked before their relatives
 * Only fetches fresh NIP-11 data when stale (older than nip11_cache_ttl)
 * @param nip11CacheTtl - How long to consider NIP-11 fresh (milliseconds), default 24 hours
 * @returns Array of relays that had their ignore status changed
 */
export const reevaluateAllDeduplication = async (
  nip11CacheTtl: number = 24 * 60 * 60 * 1000,
  nip11StaleSkipMs?: number,
): Promise<any[]> => {
  logger.info("Starting periodic deduplication re-evaluation for all relays...");

  // Phase 20 PERF: resolve stale-skip threshold. Caller > appConfig > 7d default.
  //
  // Consumer-side lazy conversion of the timestring field
  // appConfig.relaymon.deduplication.nip11_stale_skip (added by Plan 20-02).
  // Plan 20-02 validateConfig guarantees this field is always present as a
  // string after config validation (default "7d"), but we also accept a number
  // here in case a future plan moves conversion into processConfigTimeValues.
  // Falls through to the canonical 604_800_000 default if the field is
  // somehow absent or unparseable.
  let configStaleSkipMs: number | undefined;
  const rawStaleSkip = (appConfig?.relaymon?.deduplication as unknown as {
    nip11_stale_skip?: string | number;
  })?.nip11_stale_skip;
  if (typeof rawStaleSkip === "number" && Number.isFinite(rawStaleSkip)) {
    configStaleSkipMs = rawStaleSkip;
  } else if (typeof rawStaleSkip === "string") {
    const parsed = parseStaleSkipTimestring(rawStaleSkip);
    if (Number.isFinite(parsed)) configStaleSkipMs = parsed;
  }
  const staleSkipMs =
    nip11StaleSkipMs
    ?? configStaleSkipMs
    ?? 604_800_000;
  logger.info(`Phase 20 PERF: nip11 stale-skip threshold = ${staleSkipMs}ms`);

  const onlineRelays = getOnlineRelays();
  logger.info(`Re-evaluating ${onlineRelays.length} online relays`);

  // Import nocap dynamically (only if needed)
  const { Nocap } = await import("npm:@nostrwatch/nocap");
  const InfoAdapterDefault = (await import("npm:@nostrwatch/nocap-info-adapter-default")).default;

  // Group relays by hostname to batch NIP-11 checks
  const relaysByHostname = new Map<string, string[]>();
  for (const url of onlineRelays) {
    try {
      const parsed = new URL(url);
      const hostnameKey = `${parsed.protocol}//${parsed.hostname}`;
      if (!relaysByHostname.has(hostnameKey)) {
        relaysByHostname.set(hostnameKey, []);
      }
      relaysByHostname.get(hostnameKey)?.push(url);
    } catch (e) {
      logger.error(`Error parsing URL ${url}: ${e}`);
    }
  }

  logger.info(`Found ${relaysByHostname.size} unique hostnames`);

  interface ChangedRelay {
    url: string;
    previousIgnore: boolean;
    newIgnore: boolean;
    parent: string;
  }

  const changedRelays: ChangedRelay[] = [];
  const now = Date.now();
  let nip11ChecksPerformed = 0;

  for (const [hostnameKey, relaysInGroup] of relaysByHostname.entries()) {
    try {
      // Phase 20 PERF: determine whether this hostname group contains at
      // least one member that is both fresh (checked_at newer than
      // staleSkipMs) AND unignored. If not, skip the nocap.check call
      // entirely — the scalability win is avoiding 10s timeouts on dead
      // hostname groups. Per-group granularity (not per-row) because the
      // existing code already batches one nocap.check per hostname group.
      //
      // LOCKED INTERPRETATION (per 20-CONTEXT.md Area 4 Claude's discretion):
      // Phase 20 Success Criterion #3 ("zero nocap.check invocations for rows
      // matching either skip condition") is satisfied at PER-GROUP granularity:
      // for any group where every member is stale-or-ignored, this `continue`
      // runs BEFORE the needsNip11Refresh / nocap.check block, making the
      // nocap.check call statically unreachable for that group. This is the
      // structural guarantee that Task 2 of this plan relies on when it
      // asserts `changed.length === 0` in the all-stale / all-ignored tests:
      // no code path from this gate can reach nocap.check without the gate
      // having concluded at least one fresh-unignored member exists. See
      // 20-RESEARCH.md Pitfall 7 and Open Question 2 for the rationale.
      let hasFreshUnignoredMember = false;
      const nowMs = Date.now();
      for (const relayUrl of relaysInGroup) {
        const statusRow = db.query(
          "SELECT ignore, checked_at FROM relay_status WHERE url = ?",
          [relayUrl],
        );
        if (statusRow.length === 0) continue;
        const isIgnored = (statusRow[0][0] as number) === 1;
        const checkedAt = (statusRow[0][1] as number) || 0;
        const ageMs = checkedAt > 0 ? nowMs - checkedAt : Infinity;
        if (!isIgnored && ageMs <= staleSkipMs) {
          hasFreshUnignoredMember = true;
          break;
        }
      }
      if (!hasFreshUnignoredMember) {
        logger.debug(
          `Phase 20 PERF: skipping nocap.check for ${hostnameKey} — no fresh-unignored members (group size=${relaysInGroup.length})`,
        );
        continue;
      }

      // For each hostname group, only fetch NIP-11 once if any relay is stale
      let needsNip11Refresh = false;
      let nip11Data = null;

      // Check if any relay in this hostname group has stale NIP-11
      for (const relayUrl of relaysInGroup) {
        const info = getRelayInfo(relayUrl);
        const checkedAt = db.query("SELECT checked_at FROM relay_status WHERE url = ?", [relayUrl]);
        const age = checkedAt.length > 0 && checkedAt[0][0] !== -1
          ? now - (checkedAt[0][0] as number)
          : Infinity;

        if (age > nip11CacheTtl || !info) {
          needsNip11Refresh = true;
          break;
        }
      }

      if (needsNip11Refresh) {
        // Fetch fresh NIP-11 once for this hostname (using any relay from the group)
        const sampleRelay = relaysInGroup[0];

        const nocap = new Nocap(sampleRelay, { timeout: 10000, logLevel: "error" });
        await nocap.useAdapters([InfoAdapterDefault]);
        const checkResult = await nocap.check(["info"]).catch((err: unknown) => {
          logger.debug(`Failed to fetch NIP-11 for ${hostnameKey}: ${getErrorMessage(err)}`);
          return null;
        });

        if (checkResult?.info?.data) {
          nip11Data = checkResult.info;
          nip11ChecksPerformed++;
          logger.debug(`Fetched fresh NIP-11 for ${hostnameKey} (${relaysInGroup.length} relays in group)`);
        }
      }

      // Re-evaluate each relay in the group
      for (const relayUrl of relaysInGroup) {
        try {
          const parsed = new URL(relayUrl);
          const previousIgnoreStatus = db.query("SELECT ignore FROM relay_status WHERE url = ?", [relayUrl]);
          const wasIgnored = previousIgnoreStatus.length > 0 && previousIgnoreStatus[0][0] === 1;

          // Build result object - use fresh NIP-11 if fetched, otherwise use cached info
          const result: RelayCheckResult = {
            url: relayUrl,
            hostname: parsed.hostname,
            protocol: parsed.protocol,
            info: nip11Data || getRelayInfo(relayUrl),
            ignore: wasIgnored,
            parent: "",
            checked_at: Date.now(),
            online: !wasIgnored,
            network: "clearnet" // Will be determined by actual check
          };

          // Get parent from DB if it exists
          const parentQuery = db.query("SELECT parent FROM relay_status WHERE url = ?", [relayUrl]);
          if (parentQuery.length > 0 && parentQuery[0][0]) {
            result.parent = parentQuery[0][0] as string;
          }

          // Re-run deduplication
          // Phase 21 (item 6): pass the onlineRelays snapshot fetched at line 642
          // as DedupContext so per-row relayHostnameDedup calls reuse the cached
          // list instead of re-querying `SELECT url FROM relay_status WHERE online
          // = 1` once per row. Mirrors the Phase 20 PERF-02 tier-2 pattern now in
          // rerunDedupForAllRowsMigration (remediation.ts:118).
          const updatedResult = await relayHostnameDedup(result, { onlineUrls: onlineRelays }).catch((err: unknown) => {
            logger.error(`Error re-evaluating ${relayUrl}: ${getErrorMessage(err)}`);
            return { url: relayUrl, ignore: wasIgnored, parent: result.parent, hostname: result.hostname, protocol: result.protocol, checked_at: result.checked_at, online: result.online, network: result.network };
          });

          // If ignore status changed, update the database and track it
          if (updatedResult.ignore !== wasIgnored) {
            logger.info(`${relayUrl}: ignore status changed from ${wasIgnored} to ${updatedResult.ignore}`);

            db.query(
              "UPDATE relay_status SET ignore = ?, parent = ? WHERE url = ?",
              [updatedResult.ignore ? 1 : 0, updatedResult.parent || null, relayUrl]
            );

            changedRelays.push({
              url: relayUrl,
              previousIgnore: wasIgnored,
              newIgnore: updatedResult.ignore,
              parent: updatedResult.parent
            });

            // If newly ignored and has a parent, it was already added to ignore list in relayHostnameDedup
          }
        } catch (err: unknown) {
          logger.error(`Error processing relay ${relayUrl}: ${getErrorMessage(err)}`);
        }
      }
    } catch (err: unknown) {
      logger.error(`Error processing hostname group ${hostnameKey}: ${getErrorMessage(err)}`);
    }
  }

  logger.info(
    `Deduplication re-evaluation complete. Performed ${nip11ChecksPerformed} NIP-11 checks for ${relaysByHostname.size} hostnames. ${changedRelays.length} relays changed status.`
  );
  return changedRelays;
};
