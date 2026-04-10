// hostnames.ts
import { getLogger, LogLevel } from "./logger.ts";
import { normalizeURL } from "npm:nostr-tools/utils";
import hash from "npm:object-hash";
import { getOnlineRelays, getRelayInfo, storeRelayInfo, getRelaysWithSameInfo, getRelaysByHostname } from "../db/db.ts";
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

const isPubkey = (str: string): boolean => /^[0-9a-fA-F]{64}$/.test(str);
const containsPubkey = (str: string): boolean => /[0-9a-fA-F]{64}/.test(str);

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

/**
 * Performs hostname deduplication on a relay result.
 * It uses online relay data from the database (via getOnlineRelays) to determine whether the relay should be ignored
 * or marked as a child of another relay based on its NIP-11 info and URL characteristics.
 */
export const relayHostnameDedup = async (result: RelayCheckResult): Promise<RelayCheckResult> => {
  // Force direct console output at the start of function

  const { url: mURL, hostname: HOSTNAME, protocol: PROTOCOL } = result;

  logger.debug(`HOSTNAME: ${HOSTNAME}`);
  try {
    if (!mURL || !HOSTNAME || !PROTOCOL) {
      throw new Error(`Invalid result object: ${JSON.stringify(result)}`);
    }

    // Check if this relay is in the synced ignore list from other monitors
    if (ignoreListSyncInstance && ignoreListSyncInstance.isIgnored(mURL)) {
      logger.warn(`${mURL} is in synced ignore list from other monitors`);
      result.ignore = true;
      result.parent = ""; // We don't know the parent from synced lists
      return result;
    }

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

              const nip11RootReason = `Relay has same NIP-11 info as root URL ${rootURLs[0]}`;
              if (ignoreListSyncInstance) {
                ignoreListSyncInstance.addToIgnoreList(mURL, nip11RootReason);
              }

              // Generate deletion event for this ignored relay
              if (appConfig) {
                await deleteRelayCheckEvent(mURL, nip11RootReason, appConfig);
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
                ignoreListSyncInstance.addToIgnoreList(mURL, nip11ShorterReason);
              }

              // Generate deletion event for this ignored relay
              if (appConfig) {
                await deleteRelayCheckEvent(mURL, nip11ShorterReason, appConfig);
              }

              return result;
            }
          }
        }
      }
    }

    // Enhanced debug logging for problematic hostnames
    logger.debug(`Processing hostname dedup for target URL: ${mURL}`);

    // Retrieve online relay URLs from the SQLite DB.
    const onlineUrls = getOnlineRelays(); // returns string[]
    
    const targetRelays = onlineUrls.filter(url => url.includes(HOSTNAME));
    logger.debug(`Found ${targetRelays.length} ${HOSTNAME} relays in online relays: ${JSON.stringify(targetRelays)}`);
    
    // Convert each URL into an object with URL, hostname, and protocol.
    const online = onlineUrls.map((url: string) => {
      try {
        const parsed = new URL(url);
        // Lookup relay info from DB to ensure we have full info data, not just URL/hostname
        const relayInfo = getRelayInfo(url); // New function added to db.ts
        return { 
          url, 
          hostname: parsed.hostname, 
          protocol: parsed.protocol,
          info: relayInfo?.info || null
        };
      } catch (e) {
        return { url, hostname: "", protocol: "", info: null };
      }
    });

    interface OnlineRelay {
      url: string;
      hostname: string;
      protocol: string;
      info: { info: RelayInfo; infoHash: string } | null;
    }

    const hostnameFamily = online.filter((r: OnlineRelay) =>
      r.hostname === HOSTNAME && r.protocol === PROTOCOL && r.url !== mURL
    );
    const hostnameRelatives = [...hostnameFamily];

    logger.debug(`Found ${hostnameRelatives.length} relatives for ${mURL}:`);
    hostnameRelatives.forEach((r, idx) => {
      logger.debug(`  [${idx}] ${r.url}`);
    });

    if (!hostnameRelatives?.length) {
      // Phase 18 Fix 1: defensive-deny against the no-relatives race.
      // Phase 17 Hypothesis C confirmed that when a mutation URL's dedup runs
      // before its legit sibling's relay_status online=1 commit is visible,
      // the family is empty and the mutation escapes. Before giving up, check
      // for ANY sibling of the same hostname+protocol in relay_status (online
      // or offline). If found, mark the current URL as a duplicate of the
      // shortest known sibling.
      const allKnownSiblings = getRelaysByHostname(HOSTNAME, PROTOCOL).filter(
        (u) => u !== mURL
      );
      if (allKnownSiblings.length > 0) {
        allKnownSiblings.sort((a, b) => {
          if (a.length !== b.length) return a.length - b.length;
          return a < b ? -1 : a > b ? 1 : 0;
        });
        const shortestSibling = allKnownSiblings[0];
        result.ignore = true;
        result.parent = shortestSibling;
        const reason = `hostname has known siblings (defensive deny — Phase 18 Fix 1, parent: ${shortestSibling})`;
        logger.warn(`${mURL} | Ignored because: ${reason}`);
        if (ignoreListSyncInstance) {
          ignoreListSyncInstance.addToIgnoreList(mURL, reason);
        }
        if (appConfig) {
          await deleteRelayCheckEvent(mURL, reason, appConfig);
        }
        return result;
      }
      logger.debug(`No relatives or known siblings found for ${mURL}, returning without modification`);
      return result;
    }

    // Create a reusable hash for this relay's NIP-11 info
    const hasInfo = result?.info?.data && Object.keys(result.info.data).length > 0;
    const infoHash = createInfoHash(result?.info?.data);
    const hasValidInfoHash = infoHash !== "";
    
    // Map to store info hashes for all related relays
    const relativeInfoHashes = new Map<string, string>();
    
    logger.debug(`Current URL: ${mURL} has NIP-11 info: ${hasInfo}, hash: ${infoHash || "none"}`);
    if (hasInfo) {
      logger.debug(`NIP-11 info keys: ${JSON.stringify(Object.keys(result.info.data))}`);
    }

    // Collect info hashes from related relays if available
    for (const relayRelative of hostnameRelatives) {
      // Skip relays without info data
      if (!relayRelative.info || !relayRelative.info.data) {
        logger.debug(`Relative ${relayRelative.url} has no info data`);
        continue;
      }
      
      const { url } = relayRelative;
      const relativeHash = createInfoHash(relayRelative.info.data);
      
      if (relativeHash) {
        relativeInfoHashes.set(url, relativeHash);
        logger.debug(`Relative: ${url} with info hash: ${relativeHash}`);  
        // Debug hash comparison
        if (infoHash && infoHash === relativeHash) {
          logger.debug(`MATCH FOUND: ${mURL} has same NIP-11 info as ${url}`);
        }
      }
    }
    
    logger.debug(`Collected ${relativeInfoHashes.size} info hashes from relatives`);
    relativeInfoHashes.forEach((hash, url) => {
      logger.debug(`  ${url}: ${hash}`);
    });
    
    const relativeInfoHashesArray = Array.from(relativeInfoHashes.values());

    // Filter out empty strings for valid comparisons
    const validInfoHashes = relativeInfoHashesArray.filter(hash => hash !== "");

    logger.debug(`Valid info hashes for comparison: ${validInfoHashes.length}`);

    // Order each relay in the hostname map by URL path depth.
    const urlSegmentOrderedMap = relayArrToHostnameProtocolKeyedMap(
      [...hostnameRelatives.map((r) => r.url), mURL]
    );
    const orderedFamily = (urlSegmentOrderedMap.get(`${PROTOCOL}//${HOSTNAME}`) || []).map((r) =>
      normalizeURL(r)
    );
    
    logger.debug(`Ordered family for ${PROTOCOL}//${HOSTNAME}:`);
    orderedFamily.forEach((url, idx) => {
      logger.debug(`  [${idx}] ${url}`);
    });
    
    let orderedRelatives = orderedFamily.filter((r) => r !== mURL);
    if (!orderedRelatives || orderedRelatives.length === 0) {
      logger.error(`Ordered relatives not found for ${PROTOCOL}//${HOSTNAME}`);
      return result;
    }
    const index = orderedFamily.indexOf(mURL);
    
    logger.debug(`Current URL index in ordered family: ${index}`);
    logger.debug(`Ordered relatives: ${JSON.stringify(orderedRelatives)}`);

    if (index === 0) {
      logger.debug(`${mURL} has not been ignored and parent cleared, index: ${index}`);
      result.ignore = false;
      result.parent = "";
    } else if (index > 0) {
      result.parent = orderedRelatives[0];
      logger.debug(`${mURL} is a child of ${orderedRelatives[0]}`);
      
      // Look up the info hash for the eldest (root) relative
      const eldestRelativeHash = relativeInfoHashes.get(orderedRelatives[0]);
      const foundAtIndex = validInfoHashes.indexOf(infoHash);
      const eldestHasHash = Boolean(eldestRelativeHash);
      const eldestIsRoot = isRootUrl(orderedRelatives[0]);
      
      // Fix the comparison logic - ensure we're comparing actual hashes, not undefined values
      const isSameAsEldest = infoHash !== "" && eldestRelativeHash !== "" && infoHash === eldestRelativeHash;
      
      // Check if this relay has the same NIP-11 info as ANY of its relatives
      const isSameAsAnyRelative = infoHash !== "" && validInfoHashes.includes(infoHash);
      
      const isSameAsOlderRelative = foundAtIndex < index;
      const isSameAsYoungerRelative = foundAtIndex > index;
      const pathnameIsPubkey = new URL(mURL).pathname.split("/").some((p) => isPubkey(p));
      const pathnameContainsPubkey = containsPubkey(new URL(mURL).pathname);
      const pathnameContainsHostname = new URL(mURL).pathname.includes(HOSTNAME);

      logger.debug(`Detailed condition analysis for ${mURL}:`);
      logger.debug(`  foundAtIndex: ${foundAtIndex}`);
      logger.debug(`  eldestHasHash: ${eldestHasHash} (Eldest URL: ${orderedRelatives[0]})`);
      logger.debug(`  eldestIsRoot: ${eldestIsRoot}`);
      logger.debug(`  isSameAsEldest: ${isSameAsEldest}`);
      logger.debug(`  isSameAsAnyRelative: ${isSameAsAnyRelative}`);
      logger.debug(`  isSameAsOlderRelative: ${isSameAsOlderRelative}`);
      logger.debug(`  isSameAsYoungerRelative: ${isSameAsYoungerRelative}`);
      logger.debug(`  pathnameIsPubkey: ${pathnameIsPubkey}`);
      logger.debug(`  pathnameContainsPubkey: ${pathnameContainsPubkey}`);
      logger.debug(`  pathnameContainsHostname: ${pathnameContainsHostname}`);

      const reason1 = "Eldest is root AND eldest has NIP11 data AND current segment NIP11 data is same as eldest relative";
      const case1 = eldestIsRoot && eldestHasHash && isSameAsEldest;
      const reason2 = "Eldest is root, current segment has NIP11 data AND NIP11 data is the same as any other relay in the hostname group";
      const case2 = eldestIsRoot && infoHash !== "" && (isSameAsAnyRelative || isSameAsEldest);
      const reason3 = "Eldest is not root AND eldest NIP11 is same as an older AND younger relative";
      const case3 = !eldestIsRoot && isSameAsOlderRelative && isSameAsYoungerRelative;
      const reason4 = "Eldest is root AND eldest has NIP11 data AND current segment has no NIP11 data";
      const case4 = eldestIsRoot && eldestHasHash && !hasValidInfoHash;
      const reason5 = "Eldest is not root AND eldest does not have NIP11 data AND current segment has no NIP11 data";
      const case5 = !eldestIsRoot && !eldestHasHash && !hasValidInfoHash;
      const reason6 = "Pubkey is in pathname";
      const case6 = pathnameIsPubkey || pathnameContainsPubkey;
      const reason7 = "Path includes hostname";
      const case7 = pathnameContainsHostname;
      
      // New condition for URLs with paths that have the same NIP-11 info as any relative
      const reason8 = "URL with path has identical NIP-11 info to another relay with same hostname";
      const isPathUrl = (new URL(mURL).pathname !== "/" && new URL(mURL).pathname !== "");
      const case8 = isPathUrl && infoHash !== "" && isSameAsAnyRelative;
      
      logger.debug(`Case evaluations: [1:${case1}] [2:${case2}] [3:${case3}] [4:${case4}] [5:${case5}] [6:${case6}] [7:${case7}] [8:${case8}]`);
      
      if (case1 || case2 || case3 || case4 || case5 || case6 || case7 || case8) {
        if (case2) logger.warn(`${mURL} | Ignored because: ${reason2}`);
        if (case1) logger.warn(`${mURL} | Ignored because: ${reason1}`);
        if (case3) logger.warn(`${mURL} | Ignored because: ${reason3}`);
        if (case4) logger.warn(`${mURL} | Ignored because: ${reason4}`);
        if (case5) logger.warn(`${mURL} | Ignored because: ${reason5}`);
        if (case6) logger.warn(`${mURL} | Ignored because: ${reason6}`);
        if (case7) logger.warn(`${mURL} | Ignored because: ${reason7}`);
        if (case8) logger.warn(`${mURL} | Ignored because: ${reason8}`);
        logger.debug(`${mURL} has been ignored because of: case [1:${case1}] [2:${case2}] [3:${case3}] [4:${case4}] [5:${case5}] [6:${case6}] [7:${case7}] [8:${case8}]`);
        result.ignore = true;

        // Compute the reason for ignoring
        let reason = "Duplicated relay with same hostname";
        if (case1) reason = reason1;
        if (case2) reason = reason2;
        if (case3) reason = reason3;
        if (case4) reason = reason4;
        if (case5) reason = reason5;
        if (case6) reason = reason6;
        if (case7) reason = reason7;
        if (case8) reason = reason8;

        if (result.parent) {
          reason += ` (parent: ${result.parent})`;
        }

        // Add to IgnoreListSync if it has a parent (i.e., is a deduplication ignore, not remote sync)
        if (result.parent && ignoreListSyncInstance) {
          ignoreListSyncInstance.addToIgnoreList(mURL, reason);
        }

        // Generate deletion event when a relay is ignored
        if (appConfig) {
          await deleteRelayCheckEvent(mURL, reason, appConfig);
        }
      } else {
        result.ignore = false;
        logger.debug(`${mURL} was NOT ignored as no conditions matched`);
      }
    } else {
      result.ignore = true;
      logger.error(`CRITICAL ERROR! relayHostnameDedup(): ${mURL} not found in hostnameGroup`);
    }
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
export const reevaluateAllDeduplication = async (nip11CacheTtl: number = 24 * 60 * 60 * 1000): Promise<any[]> => {
  logger.info("Starting periodic deduplication re-evaluation for all relays...");

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
          const updatedResult = await relayHostnameDedup(result).catch((err: unknown) => {
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
