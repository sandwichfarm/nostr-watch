// hostnames.ts
import Logger from "npm:@nostrwatch/logger";
import { normalizeURL } from "npm:nostr-tools/utils";
import hash from "npm:object-hash";
import { getOnlineRelays } from "./db.ts"; // Import our new function from db.ts

const log = new Logger("@nostrwatch/relaymon:hostname");

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
      log.error(`Invalid URL: ${url}`);
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
export const relayListHostnameDedup = async (relays: any[], cache: any): Promise<any[]> => {
  const maybeModifiedRelays: any[] = [];
  for (const relay of relays) {
    maybeModifiedRelays.push(await relayHostnameDedup(relay, cache));
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
 * Performs hostname deduplication on a relay result.
 * It uses online relay data from the database (via getOnlineRelays) to determine whether the relay should be ignored
 * or marked as a child of another relay based on its NIP-11 info and URL characteristics.
 */
export const relayHostnameDedup = async (result: any, cache: any): Promise<any> => {
  const { url: mURL, hostname: HOSTNAME, protocol: PROTOCOL } = result;
  try {
    if (!mURL || !HOSTNAME || !PROTOCOL) {
      throw new Error(`Invalid result object: ${JSON.stringify(result)}`);
    }

    // Retrieve online relay URLs from the SQLite DB.
    const onlineUrls = getOnlineRelays(); // returns string[]
    // Convert each URL into an object with URL, hostname, and protocol.
    const online = onlineUrls.map((url: string) => {
      const parsed = new URL(url);
      return { url, hostname: parsed.hostname, protocol: parsed.protocol };
    });

    const hostnameFamily = online.filter((r: any) =>
      r.hostname === HOSTNAME && r.protocol === PROTOCOL && r.url !== mURL
    );
    const hostnameRelatives = [...hostnameFamily];

    if (!hostnameRelatives?.length) return result;

    const hasInfo = Object.keys(result?.info?.data ?? {}).length > 0;
    const infoHash = hasInfo ? `RelayCheckInfo@${hash(result.info.data)}` : null;
    const relativeInfoHashes = new Map<string, any>();
    log.debug(`target: ${mURL} w/ info id ${infoHash}`);

    // Collect info hashes from related relays if available.
    for (const relayRelative of hostnameRelatives) {
      // If your new DB-based relay objects don't have an "info" field,
      // this part may need adjustments.
      if (relayRelative.info === null) continue;
      const { url, info: id } = relayRelative;
      log.debug(`relative: ${url} w/ info id ${id}`);
      relativeInfoHashes.set(relayRelative.url, id);
    }
    const relativeInfoHashesArray = Array.from(relativeInfoHashes.values());

    // Order each relay in the hostname map by URL path depth.
    const urlSegmentOrderedMap = relayArrToHostnameProtocolKeyedMap(
      [...hostnameRelatives.map((r) => r.url), mURL]
    );
    const orderedFamily = (urlSegmentOrderedMap.get(`${PROTOCOL}//${HOSTNAME}`) || []).map((r) =>
      normalizeURL(r)
    );
    let orderedRelatives = orderedFamily.filter((r) => r !== mURL);
    if (!orderedRelatives) {
      log.error(`Ordered relatives not found for ${PROTOCOL}//${HOSTNAME}`);
      return result;
    }
    const index = orderedFamily.indexOf(mURL);

    if (index === 0) {
      log.debug(`${mURL} has not been ignored and parent cleared, index: ${index}`);
      result.ignore = false;
      result.parent = "";
    } else if (index > 0) {
      result.parent = orderedRelatives[0];
      log.debug(`${mURL} is a child of ${orderedRelatives[0]}`);
      const foundAtIndex = relativeInfoHashesArray.indexOf(infoHash);
      const eldestHasHash = Boolean(relativeInfoHashes.get(orderedRelatives[0]));
      const eldestIsRoot = isRootUrl(orderedRelatives[0]);
      const isSameAsEldest = infoHash === relativeInfoHashes.get(orderedRelatives[0]);
      const isSameAsAnyRelative = relativeInfoHashesArray.includes(infoHash);
      const isSameAsOlderRelative = foundAtIndex < index;
      const isSameAsYoungerRelative = foundAtIndex > index;
      const pathnameIsPubkey = new URL(mURL).pathname.split("/").some((p) => isPubkey(p));
      const pathnameContainsPubkey = containsPubkey(new URL(mURL).pathname);
      const pathnameContainsHostname = new URL(mURL).pathname.includes(HOSTNAME);

      const reason1 = "Eldest is root AND eldest has NIP11 data AND current segment NIP11 data is same as eldest relative";
      const case1 = eldestIsRoot && eldestHasHash && isSameAsEldest;
      const reason2 = "Eldest is root, current segment has NIP11 data AND NIP11 data is the same as any other relay in the hostname group";
      const case2 = eldestIsRoot && infoHash && (isSameAsAnyRelative || isSameAsEldest);
      const reason3 = "Eldest is not root AND eldest NIP11 is same as an older AND younger relative";
      const case3 = !eldestIsRoot && isSameAsOlderRelative && isSameAsYoungerRelative;
      const reason4 = "Eldest is root AND eldest has NIP11 data AND current segment has no NIP11 data";
      const case4 = eldestIsRoot && eldestHasHash && !infoHash;
      const reason5 = "Eldest is not root AND eldest does not have NIP11 data AND current segment has no NIP11 data";
      const case5 = !eldestIsRoot && !eldestHasHash && !infoHash;
      const reason6 = "Pubkey is in pathname";
      const case6 = pathnameIsPubkey || pathnameContainsPubkey;
      const reason7 = "Path includes hostname";
      const case7 = pathnameContainsHostname;
      if (case1 || case2 || case3 || case4 || case5 || case6 || case7) {
        if (case1) log.warn(`Ignored because: ${reason1}`);
        if (case2) log.warn(`Ignored because: ${reason2}`);
        if (case3) log.warn(`Ignored because: ${reason3}`);
        if (case4) log.warn(`Ignored because: ${reason4}`);
        if (case5) log.warn(`Ignored because: ${reason5}`);
        if (case6) log.warn(`Ignored because: ${reason6}`);
        if (case7) log.warn(`Ignored because: ${reason7}`);
        log.debug(`${mURL} has been ignored because of: case [1:${case1}] [2:${case2}] [3:${case3}] [4:${case4}] [5:${case5}] [6:${case6}] [7:${case7}]`);
        result.ignore = true;
      } else {
        result.ignore = false;
      }
    } else {
      log.error(`CRITICAL ERROR! relayHostnameDedup(): ${mURL} not found in hostnameGroup`);
    }
  } catch (error) {
    log.error(`Error in relayHostnameDedup: ${error}`);
  }
  return result;
};
