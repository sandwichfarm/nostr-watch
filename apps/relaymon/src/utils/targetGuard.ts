import { lookup } from "node:dns/promises";
import { isLocalNetworkHost, parseRelayNetwork } from "@nostrwatch/utils";

/** Resolves a hostname to every address the OS resolver would connect to. */
export type AddressResolver = (hostname: string) => Promise<string[]>;

/** getaddrinfo-backed, so /etc/hosts and search domains are honored exactly
 * as they are for the WebSocket and HTTP connections the checks make. */
const systemResolver: AddressResolver = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address);

/** Resolver output in the form URL parsing produces, so every IPv6 spelling
 * (including dotted IPv4-mapped ones) is judged the same way as a literal. */
const canonicalAddress = (address: string): string => {
  if (!address.includes(":")) return address;
  try {
    return new URL(`http://[${address.split("%")[0]}]/`).hostname;
  } catch {
    return address;
  }
};

export class LocalTargetError extends Error {
  constructor(readonly url: string, readonly detail: string) {
    super(`Refusing to check ${url}: ${detail}`);
    this.name = "LocalTargetError";
  }
}

/**
 * Refuse relay URLs that would make this monitor connect to itself or to a
 * private network. Relay URLs come from untrusted events and check results
 * are published, so an internal target would leak reachability and content.
 *
 * Only clearnet URLs are inspected: Tor, I2P, FIPS and CJDNS hostnames are
 * routed by their own transports and are not resolved here.
 *
 * A name that fails to resolve is allowed through; the check then fails the
 * same way it always has. A name that changes its answer between this lookup
 * and the connection is not caught.
 */
export async function assertPublicTarget(
  url: string,
  resolve: AddressResolver = systemResolver,
): Promise<void> {
  if (parseRelayNetwork(url) !== "clearnet") return;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new LocalTargetError(url, "URL cannot be parsed");
  }
  if (isLocalNetworkHost(hostname)) {
    throw new LocalTargetError(url, "host is a loopback or private network address");
  }
  // IP literals were fully decided by the hostname check above.
  if (hostname.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return;

  let addresses: string[];
  try {
    addresses = await resolve(hostname);
  } catch {
    return;
  }
  const local = addresses.find((address) => isLocalNetworkHost(canonicalAddress(address)));
  if (local) {
    throw new LocalTargetError(url, `${hostname} resolves to local address ${local}`);
  }
}
