import { describe, it, expect } from 'vitest';
import { validateRelayUrl, validateNpub, validateNsec, validateYaml, validateConfig } from './validate.ts';

describe('validateRelayUrl', () => {
  it('returns null for valid wss:// URL', () => {
    expect(validateRelayUrl('wss://relay.damus.io')).toBeNull();
  });

  it('returns null for ws:// URL (valid for local testing)', () => {
    expect(validateRelayUrl('ws://localhost:7777')).toBeNull();
  });

  it('returns error string for http:// URL', () => {
    const result = validateRelayUrl('http://relay.damus.io');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('returns error string for not a URL', () => {
    const result = validateRelayUrl('not a url');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('returns error string for wss// missing colon', () => {
    const result = validateRelayUrl('wss//missing-colon');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

describe('validateNpub', () => {
  // Valid npub: "npub1" + 58 lowercase alphanumeric bech32 chars
  const validNpub = 'npub1' + 'a'.repeat(58);

  it('returns null for valid npub', () => {
    // Use a known valid npub
    expect(validateNpub('npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s')).toBeNull();
  });

  it('returns error string for short npub', () => {
    const result = validateNpub('npub1short');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('returns error string for nsec prefix', () => {
    const result = validateNpub('nsec1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

describe('validateNsec', () => {
  it('returns null for valid nsec', () => {
    // Generated valid nsec (nsec1 + 58 bech32 chars = 63 total)
    expect(validateNsec('nsec1de6squ927da3s08p2wquy8f6zhspenl2c8m67gt0d2ychwga3a4s6vlu5e')).toBeNull();
  });

  it('returns error string for empty string', () => {
    const result = validateNsec('');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('returns error string for npub prefix', () => {
    const result = validateNsec('npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

describe('validateYaml', () => {
  it('returns ok: true with data for valid YAML', () => {
    const result = validateYaml('key: value');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ key: 'value' });
    }
  });

  it('returns ok: false with error for broken YAML', () => {
    const result = validateYaml('invalid: yaml: [broken');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe('validateConfig', () => {
  const validConfig = {
    monitor: {
      slug: 'my-monitor',
      info: {
        name: 'My Monitor',
        about: 'A test monitor',
      },
    },
    publisher: {
      relays: ['wss://relay.damus.io'],
    },
    relaymon: {
      networks: ['clearnet'],
      seed: {
        sources: ['config'],
      },
    },
  };

  it('returns empty array for valid config', () => {
    const errors = validateConfig(validConfig);
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBe(0);
  });

  it('returns error for missing monitor.slug', () => {
    const config = { ...validConfig, monitor: { info: { name: 'x', about: 'y' } } };
    const errors = validateConfig(config);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('slug'))).toBe(true);
  });

  it('returns error for empty publisher.relays', () => {
    const config = { ...validConfig, publisher: { relays: [] } };
    const errors = validateConfig(config);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns error for invalid relay URL in publisher.relays', () => {
    const config = { ...validConfig, publisher: { relays: ['http://not-a-relay.com'] } };
    const errors = validateConfig(config);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns error for empty relaymon.networks', () => {
    const config = { ...validConfig, relaymon: { ...validConfig.relaymon, networks: [] } };
    const errors = validateConfig(config);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns error for empty relaymon.seed.sources', () => {
    const config = { ...validConfig, relaymon: { ...validConfig.relaymon, seed: { sources: [] } } };
    const errors = validateConfig(config);
    expect(errors.length).toBeGreaterThan(0);
  });
});
