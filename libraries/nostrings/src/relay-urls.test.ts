import { describe, it, expect } from 'vitest';
import {
  sanitize,
  maybeSplitRelayList,
  sanitizeRelayUrl,
  qualifyRelayUrl,
  normalizeRelayUrlAcc,
  normalizeRelayUrls,
  normalizeRelayUrl
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
