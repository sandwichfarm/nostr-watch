import { describe, expect, it } from 'vitest';
import { parseRelayNetwork, relaysSerializedByNetwork } from './utils';

describe('FIPS network classification', () => {
  it.each([
    ['ws://relay.fips:7777/nostr', 'fips'],
    ['wss://npub1example.fips', 'fips'],
    ['ws://RELAY.FIPS./', 'fips'],
    ['wss://relay.fips.example.org', 'clearnet'],
    ['wss://relay.example.org/path.fips', 'clearnet'],
    ['wss://relay.fips@public.example.org', 'clearnet'],
    ['ws://[fd12:3456::1]:7777', 'clearnet'],
    ['wss://relay.onion', 'tor'],
    ['ws://relay.i2p', 'i2p'],
    ['not a URL', 'clearnet'],
  ])('classifies %s as %s', (url, network) => {
    expect(parseRelayNetwork(url)).toBe(network);
  });

  it('partitions FIPS separately from other networks', () => {
    const urls = ['ws://relay.fips', 'ws://relay.i2p', 'wss://relay.example.org'];
    expect(relaysSerializedByNetwork(urls)).toEqual({
      fips: [urls[0]], i2p: [urls[1]], clearnet: [urls[2]],
    });
  });
});
