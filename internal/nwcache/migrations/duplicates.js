
import dotenv from 'dotenv'
dotenv.config()

import nostrings from '@nostrwatch/nostrings'

function groupUrlsByHostname(urls) {
  const urlMap = new Map();

  urls.forEach((url) => {
    try {
      const hostname = new URL(url).hostname;

      if (!urlMap.has(hostname)) {
        urlMap.set(hostname, []);
      }

      urlMap.get(hostname).push(url);
    } catch (error) {
      console.error(`Invalid URL: ${url}`);
    }
  });

  return urlMap;
}

function groupUrlsByProtocolAndHostname(urls) {
  const urlMap = new Map();

  urls.forEach((url) => {
    try {
      const parsedUrl = new URL(url);
      const protocolAndHostname = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

      if (!urlMap.has(protocolAndHostname)) {
        urlMap.set(protocolAndHostname, []);
      }

      urlMap.get(protocolAndHostname).push(url);
    } catch (error) {
      console.error(`Invalid URL: ${url}`);
    }
  });

  return urlMap;
}

function findClosestToRoot(urlMap) {
  const closestToRootMap = new Map();
  urlMap.forEach((urls, protocolAndHostname) => {
    urls.sort((a, b) => {
      const pathDepthA = new URL(a).pathname.split('/').filter(Boolean).length;
      const pathDepthB = new URL(b).pathname.split('/').filter(Boolean).length;
      if (pathDepthA === pathDepthB) {
        return a.length - b.length;
      }
      return pathDepthA - pathDepthB;
    });
    closestToRootMap.set(protocolAndHostname, urls[0]);
  });
  return Array.from(closestToRootMap, ([protocolAndHostname, url]) => new URL(url).toString());
}

function diffBetweenArrays(array1, array2) {
  const set1 = new Set(array1);
  const set2 = new Set(array2);

  const diff1 = array1.filter(item => !set2.has(item)); // In array1 but not in array2
  const diff2 = array2.filter(item => !set1.has(item)); // In array2 but not in array1

  return {
    onlyInFirstArray: diff1,
    onlyInSecondArray: diff2
  };
}

function filterMapWithMultipleEntries(urlMap) {
  const newMap = new Map();

  urlMap.forEach((urls, hostname) => {
    if (urls.length > 1) {
      newMap.set(hostname, urls);
    }
  });

  return newMap;
}

export const FindClosestToRoot = async(rcache) => {
  let relays = (await rcache.relay.get.all()).map(r => r.url)
      relays = nostrings.sanitize.relayUrls(relays)

  if(!relays?.length) return console.log(`Migrate: SanitizeRelayUrls: No relays found.`)

  const grouped = groupUrlsByProtocolAndHostname(relays)
  const closestToRoot = findClosestToRoot(grouped)
  const diff = diffBetweenArrays(relays, closestToRoot)

  const REMOVE_THESE = diff.onlyInFirstArray
  console.log("all relays", relays.length, closestToRoot.length)
  console.log("only first", diff.onlyInFirstArray)
  console.log("only second", diff.onlyInSecondArray.length)
  
  // const relaysIgnored = (await rcache.relay.get.ignored()).map(r => r.url)
  // const relaysNotIgnored = (await rcache.relay.get.notIgnored()).map(r => r.url)

  let relaysOnline = (await rcache.relay.get.online()).map(r => r.url)

  const groupedOnline  = groupUrlsByProtocolAndHostname(relaysOnline)
  const closestToRootOnline  = findClosestToRoot(groupedOnline)
  const multipleEntriesOnlyOnline = filterMapWithMultipleEntries(groupedOnline)

  // const diffOnline = diffBetweenArrays(relaysOnline, closestToRootOnline)
  // console.log("ignored relays", relaysIgnored.length)
  // console.log("not ignored relays", "valid:", relaysNotIgnored.length === relays.length, relaysNotIgnored.length, relays.length)
  console.log("online relays", relaysOnline.length, closestToRootOnline.length)
  console.log("keys with multiple entries", multipleEntriesOnlyOnline.size)
  // console.log(multipleEntriesOnlyOnline)
  // console.log("only first", diffOnline.onlyInFirstArray)
  // console.log("only second", diffOnline.onlyInSecondArray)
  // console.log(relaysOnline)

  // for(const relay of REMOVE_THESE) {
  //   const r = rcache.relay.get.one(relay)
  //   if(!r) {
  //     console.log(`!!! ${relay} does not exist`)
  //     continue
  //   }
  //   // else 
  //   //   console.log(`${relay} exists: ${r['#']}`)
  //   await rcache.relay.delete(relay)
  //   console.log('deleted:', relay)
  // }
  // process.exit()
}
