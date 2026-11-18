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

const LOCAL_HOST_SUFFIXES = ['.localhost', '.local', '.localdomain', '.lan', '.internal', '.intranet', '.home.arpa'];

const ipv4Octets = (hostname: string): number[] | null => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
};

const isLocalIpv4 = ([a, b]: number[]): boolean =>
  a === 0 || // "this" network, 0.0.0.0
  a === 127 || // loopback
  a === 10 || // private
  (a === 172 && b >= 16 && b <= 31) || // private
  (a === 192 && b === 168) || // private
  (a === 169 && b === 254) || // link-local
  (a === 100 && b >= 64 && b <= 127); // carrier-grade NAT

const isLocalIpv6 = (address: string): boolean => {
  if (address === '::' || address === '::1') return true;
  // IPv4-mapped (::ffff:7f00:1) and IPv4-compatible forms, as serialized by URL.
  const mapped = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    return isLocalIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }
  const first = parseInt(address.split(':')[0] || '0', 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80; // unique-local, link-local
};

/**
 * True when a hostname names this device or a private/local network:
 * loopback, RFC 1918, link-local, CGNAT, IPv6 unique-local, and local-only
 * name suffixes. Takes the hostname as `new URL(...).hostname` reports it.
 */
export const isLocalNetworkHost = (rawHostname: string): boolean => {
  const hostname = rawHostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) return true;
  if (hostname.startsWith('[') && hostname.endsWith(']')) return isLocalIpv6(hostname.slice(1, -1));
  if (hostname.includes(':')) return isLocalIpv6(hostname);
  const octets = ipv4Octets(hostname);
  if (octets) return isLocalIpv4(octets);
  if (hostname === 'localhost') return true;
  return LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
};

/**
 * True when a URL must not be requested from a public web page: it targets a
 * local/private host or cannot be parsed. `new URL` normalizes decimal, hex
 * and octal IPv4 spellings for http(s)/ws(s), so those are covered.
 * A public name that resolves to a local address is not detectable here.
 */
export const isLocalNetworkUrl = (url: string | URL): boolean => {
  try {
    return isLocalNetworkHost(new URL(url).hostname);
  } catch {
    return true;
  }
};
