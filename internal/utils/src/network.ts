/**
 * Network Configuration
 */

const networks: Record<string, (url: string) => boolean> = {};

// Clearnet is default
networks.tor = (url: string): boolean => { 
  try {
    return new URL(url).hostname.endsWith('.onion');
  } catch (e) {
    return false;
  }
};

networks.i2p = (url: string): boolean => {
  try {
    return new URL(url).hostname.endsWith('.i2p');
  } catch (e) {
    return false;
  }
};

// FIPS uses the host's resolver and IPv6 routing. ULA addresses alone do not
// identify FIPS: other private networks use the same address range.
networks.fips = (url: string): boolean => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '').endsWith('.fips');
  } catch {
    return false;
  }
};

networks.cjdns = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.startsWith('fc00:') || hostname.startsWith('fc01:')) {
      return true;
    }
  } catch (e) {}
  return false;
};

/** */
export const parseRelayNetwork = (url: string): string => {
  for (const network in networks) {
    if (networks[network](url)) {
      return network;
    }
  }
  return 'clearnet';
};

export const relaysSerializedByNetwork = (urls: string[]): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  urls.forEach((url) => {
    const network = parseRelayNetwork(url);
    if (!result[network]) {
      result[network] = [];
    }
    result[network].push(url);
  });
  return result;
};
