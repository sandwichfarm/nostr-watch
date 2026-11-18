import { describe, it, expect } from 'vitest';
import {
  sanitize,
  maybeSplitRelayList,
  sanitizeRelayUrl,
  qualifyRelayUrl,
  normalizeRelayUrlAcc,
  normalizeRelayUrls,
  normalizeRelayUrl,
  isNatoPhoneticSpam,
  isValidRelayHostname,
} from './relay-urls.js';  // Adjust this import to your actual file path

describe('sanitize', () => {
  it('should correct a wire array of mishaps', () => {
    const relays = ['wss://relay.example.com', '  wss://RELAY.EXAMPLE.COM ', 'wss://RELAY.EXAMPLE.COM./', '  wss://RELAY.EXAMPLE.COM./#ok ', 'wss://relay1.example.com, wss://relay2.example.com'];
    const result = sanitize(relays);
    expect(result).toEqual(['wss://relay.example.com/', 'wss://relay1.example.com/', 'wss://relay2.example.com/']);
  });

  it('should return undefined if input is empty', () => {
    const relays: string[] = [];
    const result = sanitize(relays);
    expect(result).toBeUndefined();
  });

  it('should deduplicate relay URLs', () => {
    const relays: string[] = ['wss://relay.example.com', '  wss://RELAY.EXAMPLE.COM ', 'wss://RELAY.EXAMPLE.COM'];
    const result = sanitize(relays);
    expect(result).toEqual(['wss://relay.example.com/']);
  });
});

describe('maybeSplitRelayList', () => {
  it('should split relays that contain commas', () => {
    const relays = ['wss://relay1.example.com,wss://relay2.example.com'];
    const result = maybeSplitRelayList(relays);
    expect(result).toEqual(['wss://relay1.example.com', 'wss://relay2.example.com']);
  });

  it('should return relays unchanged if no commas present', () => {
    const relays = ['wss://relay.example.com'];
    const result = maybeSplitRelayList(relays);
    expect(result).toEqual(['wss://relay.example.com']);
  });
});

describe('sanitizeRelayUrl', () => {
  it('should sanitize and remove trailing slashes and dots', () => {
    const relay = '  wss://RELAY.EXAMPLE.COM./  ';
    const result = sanitizeRelayUrl(relay);
    expect(result).toBe('wss://relay.example.com');
  });

  it('should return empty string if the URL is invalid', () => {
    const relay = ' wss://relay.example.com/(blob_hash), wss://another.relay  ';
    const result = sanitizeRelayUrl(relay);
    expect(result).toBe('wss://relay.example.com/');
  });
});

describe('qualifyRelayUrl', () => {
  it('should return true for valid relay URLs', () => {
    const relay = 'wss://relay.example.com';
    const result = qualifyRelayUrl(relay);
    expect(result).toBe(true);
  });

  it('should return false for invalid relay URLs', () => {
    const relay = 'http://invalid.example.com';
    const result = qualifyRelayUrl(relay);
    expect(result).toBe(false);
  });

  it('should return false for multiple protocol URLs', () => {
    const relay = 'wss://wss://relay.example.com';
    const result = qualifyRelayUrl(relay);
    expect(result).toBe(false);
  });
});

describe('normalizeRelayUrlAcc', () => {
  it('should accumulate normalized relay URLs', () => {
    const acc: string[] = [];
    const relay = 'wss://relay.example.com';
    const result = normalizeRelayUrlAcc(acc, relay);
    expect(result).toEqual(['wss://relay.example.com/']);
  });

  it('should skip adding empty normalized relay URLs', () => {
    const acc: string[] = ['wss://relay1.example.com'];
    const relay = '';
    const result = normalizeRelayUrlAcc(acc, relay);
    expect(result).toEqual(['wss://relay1.example.com']);
  });
});

describe('normalizeRelayUrls', () => {
  it('should normalize an array of relay URLs', () => {
    const relays = ['wss://relay1.example.com', 'wss://RELAY2.EXAMPLE.COM'];
    const result = normalizeRelayUrls(relays);
    expect(result).toEqual(['wss://relay1.example.com/', 'wss://relay2.example.com/']);
  });
});

describe('normalizeRelayUrl', () => {
  it('should normalize a relay URL by stripping hash and search parameters', () => {
    const relay = 'wss://relay.example.com/path?query=1#section';
    const result = normalizeRelayUrl(relay);
    expect(result).toBe('wss://relay.example.com/path');
  });

  it('should return empty string for invalid relay URL', () => {
    const relay = 'invalid-url';
    const result = normalizeRelayUrl(relay);
    expect(result).toBe('');
  });
});

describe('qualifyRelayUrl - spam word blocking', () => {
  it('should reject single NATO code suffix', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/alpha')).toBe(false);
  });

  it('should reject single custom spam word suffix', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/beacon')).toBe(false);
  });

  it('should reject two hyphen-separated spam words', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/jade-karma')).toBe(false);
  });

  it('should reject three hyphen-separated mixed spam words', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/dynamo-echo-flint')).toBe(false);
  });

  it('should allow four+ spam words (only 1-3 blocked)', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/alpha-bravo-charlie-delta')).toBe(true);
  });

  it('should allow URLs with no path', () => {
    expect(qualifyRelayUrl('wss://relay.example.com')).toBe(true);
  });

  it('should allow non-spam path segments', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/custom-path')).toBe(true);
  });

  it('should allow non-spam single-word paths', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/inbox')).toBe(true);
  });

  it('should reject spam word in last path segment with multiple segments', () => {
    expect(qualifyRelayUrl('wss://relay.example.com/something/marble')).toBe(false);
  });

  it('should reject all 52 spam words individually', () => {
    const words = [
      "alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
      "golf", "hotel", "india", "juliet", "kilo", "lima",
      "mike", "november", "oscar", "papa", "quebec", "romeo",
      "sierra", "tango", "uniform", "victor", "whiskey", "xray",
      "yankee", "zulu",
      "anchor", "beacon", "cipher", "dynamo", "ember", "flint",
      "glyph", "haven", "ivory", "jade", "karma", "lantern",
      "marble", "nexus", "onyx", "prism", "quartz", "raven",
      "sable", "titan", "umbra", "vertex", "warden", "xenon",
      "yonder", "zenith",
    ];
    for (const word of words) {
      expect(qualifyRelayUrl(`wss://relay.example.com/${word}`)).toBe(false);
    }
  });
});

describe('qualifyRelayUrl - mangled/double-slash URLs', () => {
  it('should reject hostnames without a dot (mangled protocol URLs)', () => {
    expect(qualifyRelayUrl('wss://wws//nos.lol')).toBe(false);
    expect(qualifyRelayUrl('wss://wscp//192.168.8.23:4848')).toBe(false);
    expect(qualifyRelayUrl('wss://was//nostr.land.cc')).toBe(false);
    expect(qualifyRelayUrl('wss://(wss//relay.primal.net)')).toBe(false);
  });
});

describe('sanitize - NATO phonetic spam end-to-end', () => {
  it('should filter out NATO spam URLs from a mixed list', () => {
    const relays = ['wss://relay.example.com/alpha', 'wss://good.relay.com'];
    const result = sanitize(relays);
    expect(result).toEqual(['wss://good.relay.com/']);
  });
});

describe('qualifyRelayUrl local network rejection', () => {
  it.each([
    'ws://localhost:7777',
    'ws://127.0.0.1:7777',
    'ws://192.168.1.1',
    'ws://10.0.0.5',
    'ws://172.16.0.1:8080',
    'ws://169.254.169.254',
    'ws://100.64.0.1',
    'ws://0.0.0.0:6379',
    'ws://[::1]:6379',
    'ws://[::ffff:127.0.0.1]:6379',
    'ws://[fd00::1]',
    'ws://2130706433:6379',
    'ws://0x7f.0.0.1:6379',
    'ws://nas.local',
    'ws://router.lan',
    'ws://host.docker.internal:5432',
    'ws://metadata.google.internal',
  ])('rejects %s', (url) => {
    expect(qualifyRelayUrl(url)).toBe(false);
    expect(sanitize([url])).toEqual([]);
  });

  it.each([
    'wss://relay.damus.io',
    'wss://localhost.example.org',
    'wss://local.example.org',
    'wss://8.8.8.8',
    'wss://172.32.0.1',
    'wss://100.128.0.1',
  ])('still accepts %s', (url) => {
    expect(qualifyRelayUrl(url)).toBe(true);
  });
});

// Hostnames Deno's --allow-net refuses ("empty label found in FQDN", "invalid
// char found in FQDN") must never qualify: relaymon cannot check them, and the
// isolated check child exits at startup for each attempt.
describe('isValidRelayHostname', () => {
  it.each([
    '.well-known',
    'a..b',
    '.',
    '..',
    'relay.example.com..',
    'a*b.com',
    'a~b.com',
    'a!b.com',
    'a$b.com',
    'a(b.com',
    "a'b.com",
    `${'a'.repeat(64)}.com`,
    `${'abcdefg.'.repeat(32)}com`,
    '[]',
    '[::1',
    '',
  ])('rejects %j', (hostname) => {
    expect(isValidRelayHostname(hostname)).toBe(false);
  });

  it.each([
    'relay.example.com',
    'relay.example.com.',
    'relay_x.example.com',
    'xn--bcher-kva.example',
    `${'a'.repeat(63)}.com`,
    '8.8.8.8',
    '[2001:db8::1]',
    'abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwx.onion',
  ])('accepts %j', (hostname) => {
    expect(isValidRelayHostname(hostname)).toBe(true);
  });
});

describe('qualifyRelayUrl invalid hostname rejection', () => {
  it.each([
    'wss://.well-known/nip50/is:rising/sort:top/language:en',
    'wss://.relay.example.com',
    'wss://relay..example.com',
    'wss://re*lay.example.com',
    'wss://relay~.example.com',
    `wss://${'a'.repeat(64)}.example.com`,
  ])('rejects %s', (url) => {
    expect(qualifyRelayUrl(url)).toBe(false);
    expect(sanitize([url])).toEqual([]);
  });

  it('rejects a doubled trailing dot', () => {
    expect(qualifyRelayUrl('wss://relay.example.com../')).toBe(false);
  });

  it('accepts a single trailing root dot and sanitize strips it', () => {
    expect(qualifyRelayUrl('wss://relay.example.com./')).toBe(true);
    expect(sanitize(['wss://relay.example.com./'])).toEqual(['wss://relay.example.com/']);
  });

  it('still accepts underscores and punycode', () => {
    expect(qualifyRelayUrl('wss://relay_1.example.com')).toBe(true);
    expect(qualifyRelayUrl('wss://xn--bcher-kva.example/')).toBe(true);
  });
});
