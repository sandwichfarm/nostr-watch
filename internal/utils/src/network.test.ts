import { describe, expect, it } from 'vitest';
import * as shared from './network';

for (const [name, implementation] of Object.entries({ shared })) {
  describe(`${name} network contract`, () => {
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
      expect(implementation.parseRelayNetwork(url)).toBe(network);
    });

    it('partitions FIPS separately from other networks', () => {
      const urls = ['ws://relay.fips', 'ws://relay.i2p', 'wss://relay.example.org'];
      expect(implementation.relaysSerializedByNetwork(urls)).toEqual({
        fips: [urls[0]], i2p: [urls[1]], clearnet: [urls[2]],
      });
    });
  });
}

describe('isLocalNetworkUrl', () => {
  it.each([
    'ws://localhost:4869',
    'ws://LOCALHOST./',
    'wss://relay.localhost',
    'ws://127.0.0.1:7777',
    'http://127.1/',
    'http://2130706433/',
    'http://0x7f.0.0.1/',
    'http://0177.0.0.1/',
    'ws://0.0.0.0:8080',
    'ws://[::1]:7777',
    'ws://[::]:7777',
    'ws://[::ffff:127.0.0.1]/',
    'ws://[::ffff:192.168.1.5]/',
    'wss://10.0.0.5',
    'wss://172.16.0.1',
    'wss://172.31.255.255',
    'wss://192.168.1.1:8443',
    'http://169.254.169.254/latest/meta-data',
    'wss://100.64.0.1',
    'ws://[fd12:3456::1]:7777',
    'ws://[fe80::1]/',
    'ws://umbrel.local:4848',
    'wss://nas.lan',
    'wss://relay.internal',
    'wss://router.home.arpa',
    'not a url',
    '',
  ])('blocks %s', (url) => {
    expect(shared.isLocalNetworkUrl(url)).toBe(true);
  });

  it.each([
    'wss://relay.damus.io',
    'wss://relay.nostr.watch/path',
    'https://api.nostr.watch/v2/',
    'wss://172.15.0.1',
    'wss://172.32.0.1',
    'wss://100.63.0.1',
    'wss://100.128.0.1',
    'wss://8.8.8.8',
    'wss://[2606:4700::1111]',
    'wss://localhost.example.org',
    'wss://local.example.org',
    'ws://npub1example.fips:7777',
    'ws://relay.onion',
  ])('allows %s', (url) => {
    expect(shared.isLocalNetworkUrl(url)).toBe(false);
  });
});
