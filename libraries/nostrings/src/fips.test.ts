import { describe, expect, it } from 'vitest';
import { qualifyRelayUrl, sanitize } from './relay-urls.js';

// Public identity derived from the test secret new Uint8Array(32).fill(1).
const npub = 'npub1rwzv24nmzfjypx2a8m264ws9vht3uxp5vpypnluuzl67n4waq78suk0wul';
const host = `${npub}.fips`;

describe('FIPS hostname exception to npub rejection', () => {
  it.each([
    `ws://${host}`, `wss://${host}:7443/inbox`,
    `ws://${host.toUpperCase()}.:7777/relay`, `wss://${host}./`,
  ])('accepts %s', (url) => {
    expect(qualifyRelayUrl(url)).toBe(true);
    expect(sanitize([url])).toHaveLength(1);
  });

  it('normalizes case, preserves port/path, and deduplicates', () => {
    expect(sanitize([`WS://${host.toUpperCase()}:7777/inbox`, `ws://${host}:7777/inbox`]))
      .toEqual([`ws://${host}:7777/inbox`]);
  });

  it.each([
    `ws://${host}/${npub}`, `ws://${host}/prefix-npub-suffix/inbox`,
    `ws://${host}/npub/../inbox`, `ws://${host}/%6epub`,
    `ws://${npub}.example.com`, `ws://${npub}.fips.example.com`,
    `ws://${npub}.fips.evil`,
    `ws://${npub}.onion`, `ws://${npub}.i2p`,
    `ws://${npub}@relay.fips`, `ws://user:${npub}@${host}`,
    `ws://${host}?key=${npub}`, `ws://${host}#${npub}`,
    `wss://relay.example.com/${npub}`, `ws://relay.onion/${npub}`,
    `ws://${host}/alpha`, `ws://${host}/jade-karma`,
    `http://${host}`, `wss://wss://${host}`, `not a url`,
  ])('still rejects %s', (url) => {
    expect(sanitize([url])).toEqual([]);
  });

  it('preserves other networks and malformed URL filtering', () => {
    expect(sanitize([
      'wss://relay.example.com', 'ws://relay.onion', 'ws://relay.i2p',
      'wss://wws//nos.lol', 'ws://localhost:7777', 'ws://192.168.1.1',
      'wss://relay.example.com/alpha',
    ])).toEqual(['wss://relay.example.com/', 'ws://relay.onion/', 'ws://relay.i2p/']);
  });

  it('does not treat multiple trailing dots as the FIPS suffix during qualification', () => {
    expect(qualifyRelayUrl(`ws://${host}../`)).toBe(false);
  });
});
