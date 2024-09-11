/**
 * Groups an array of URLs by their hostname.
 * @param {string[]} urls - The array of URLs to group by hostname.
 * @returns {Map<string, string[]>} A map where the keys are hostnames and the values are arrays of URLs associated with each hostname.
 */
function groupUrlsByHostname(urls: string[]): Map<string, string[]> {
  const urlMap = new Map<string, string[]>();

  // Group URLs by hostname
  urls.forEach((url) => {
    try {
      const hostname = new URL(url).hostname;

      if (!urlMap.has(hostname)) {
        urlMap.set(hostname, []);
      }

      urlMap.get(hostname)!.push(url); // Non-null assertion since the array is initialized above
    } catch (error) {
      console.error(`Invalid URL: ${url}`);
    }
  });

  return urlMap;
}

/**
 * Finds the URL with the path closest to the root for each hostname.
 * @param {Map<string, string[]>} urlMap - The map where keys are hostnames and values are arrays of URLs.
 * @returns {Map<string, string>} A map where the keys are hostnames and the values are the URL with the path closest to the root for each hostname.
 */
function findClosestToRoot(urlMap: Map<string, string[]>): Map<string, string> {
  const closestToRootMap = new Map<string, string>();

  urlMap.forEach((urls, hostname) => {
    if (urls.length > 1) {
      // Sort URLs by path length (shortest first)
      urls.sort((a, b) => {
        const pathA = new URL(a).pathname;
        const pathB = new URL(b).pathname;
        return pathA.length - pathB.length;
      });
    }
    // Select the URL with the shortest path (first one after sorting)
    closestToRootMap.set(hostname, urls[0]);
  });

  return closestToRootMap;
}