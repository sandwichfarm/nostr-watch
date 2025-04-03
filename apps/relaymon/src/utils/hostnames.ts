// hostnames.ts
import { getLogger, LogLevel } from "./logger.ts";
import { normalizeURL } from "npm:nostr-tools/utils";
import hash from "npm:object-hash";
import { getOnlineRelays, getRelayInfo, storeRelayInfo, getRelaysWithSameInfo } from "../db/db.ts";
import { deleteRelayCheckEvent } from "./deletion.ts";

// Force console output for debugging

// Initialize logger with specific log level set
const logger = getLogger("Hostnames");

// Global variable to store the application config
let appConfig: any = null;

/**
 * Set the application config for use in deletion
 * @param config The application config
 */
export function setConfig(config: any): void {
  appConfig = config;
}

const isPubkey = (str: string): boolean => /^[0-9a-fA-F]{64}$/.test(str);
const containsPubkey = (str: string): boolean => /[0-9a-fA-F]{64}/.test(str);

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
export const relayListHostnameDedup = async (relays: any[]): Promise<any[]> => {
  const maybeModifiedRelays: any[] = [];
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
export function createInfoHash(infoData: any): string {
  if (!infoData || typeof infoData !== 'object' || Object.keys(infoData).length === 0) {
    return "";  // Return empty string instead of null for type safety
  }
  
  try {
    // Sort the keys to ensure consistent hashing regardless of object property order
    const normalized = {};
    Object.keys(infoData).sort().forEach(key => {
      normalized[key] = infoData[key];
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
export const relayHostnameDedup = async (result: any): Promise<any> => {
  // Force direct console output at the start of function
  
  const { url: mURL, hostname: HOSTNAME, protocol: PROTOCOL } = result;

  logger.debug(`HOSTNAME: ${HOSTNAME}`);
  try {
    if (!mURL || !HOSTNAME || !PROTOCOL) {
      throw new Error(`Invalid result object: ${JSON.stringify(result)}`);
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
              
              // Generate deletion event for this ignored relay
              if (appConfig) {
                await deleteRelayCheckEvent(
                  mURL, 
                  `Relay has same NIP-11 info as root URL ${rootURLs[0]}`, 
                  appConfig
                );
              }
              
              return result;
            }
            
            // If no root URLs, use the shortest URL
            relaysWithSameInfo.sort((a, b) => a.length - b.length);
            if (relaysWithSameInfo[0] !== mURL) {
              result.ignore = true;
              result.parent = relaysWithSameInfo[0];
              logger.debug(`Ignoring ${mURL} - has same NIP-11 info as ${relaysWithSameInfo[0]}`);
              
              // Generate deletion event for this ignored relay
              if (appConfig) {
                await deleteRelayCheckEvent(
                  mURL, 
                  `Relay has same NIP-11 info as shorter URL ${relaysWithSameInfo[0]}`, 
                  appConfig
                );
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

    const hostnameFamily = online.filter((r: any) =>
      r.hostname === HOSTNAME && r.protocol === PROTOCOL && r.url !== mURL
    );
    const hostnameRelatives = [...hostnameFamily];

    logger.debug(`Found ${hostnameRelatives.length} relatives for ${mURL}:`);
    hostnameRelatives.forEach((r, idx) => {
      logger.debug(`  [${idx}] ${r.url}`);
    });

    if (!hostnameRelatives?.length) {
      logger.debug(`No relatives found for ${mURL}, returning without modification`);
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
      const case2 = eldestIsRoot && infoHash !== "" && isSameAsAnyRelative;
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
        
        // Generate deletion event when a relay is ignored
        if (appConfig) {
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
