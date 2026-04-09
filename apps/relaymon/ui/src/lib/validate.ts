import { decode } from 'nostr-tools/nip19';
import { parse } from 'yaml';

/**
 * Validate a relay URL — must be wss:// or ws://
 * @returns null if valid, error string if invalid
 */
export function validateRelayUrl(value: string): string | null {
  if (!value || value.trim() === '') {
    return 'Relay URL is required';
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
      return `Invalid protocol "${url.protocol}" — relay URLs must use wss:// or ws://`;
    }
    return null;
  } catch {
    return `Invalid URL: "${value}" — must be a valid wss:// or ws:// URL`;
  }
}

/**
 * Validate a nostr npub key
 * @returns null if valid, error string if invalid
 */
export function validateNpub(value: string): string | null {
  if (!value || value.trim() === '') {
    return 'npub is required';
  }
  if (!value.startsWith('npub1')) {
    return 'Invalid npub — must start with "npub1"';
  }
  if (!/^npub1[a-z\d]{58}$/.test(value)) {
    return 'Invalid npub — must be exactly 63 characters (npub1 + 58 bech32 chars)';
  }
  try {
    const decoded = decode(value);
    if (decoded.type !== 'npub') {
      return `Expected npub, got ${decoded.type}`;
    }
    return null;
  } catch {
    return 'Invalid npub — bech32 decoding failed';
  }
}

/**
 * Validate a nostr nsec key
 * @returns null if valid, error string if invalid
 */
export function validateNsec(value: string): string | null {
  if (!value || value.trim() === '') {
    return 'nsec is required';
  }
  if (!value.startsWith('nsec1')) {
    return 'Invalid nsec — must start with "nsec1"';
  }
  if (!/^nsec1[a-z\d]{58}$/.test(value)) {
    return 'Invalid nsec — must be exactly 63 characters (nsec1 + 58 bech32 chars)';
  }
  try {
    const decoded = decode(value);
    if (decoded.type !== 'nsec') {
      return `Expected nsec, got ${decoded.type}`;
    }
    return null;
  } catch {
    return 'Invalid nsec — bech32 decoding failed';
  }
}

/**
 * Validate and parse a YAML string
 * @returns { ok: true, data: unknown } on success, { ok: false, error: string } on failure
 */
export function validateYaml(text: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const data = parse(text);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `YAML parse error: ${msg}` };
  }
}

/**
 * Validate a parsed config object
 * @returns array of error strings (empty = valid)
 */
export function validateConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return ['Config must be an object'];
  }

  const c = config as Record<string, unknown>;

  // Validate monitor section
  if (!c.monitor || typeof c.monitor !== 'object') {
    errors.push('Missing required field: monitor');
  } else {
    const monitor = c.monitor as Record<string, unknown>;
    if (!monitor.slug || typeof monitor.slug !== 'string') {
      errors.push('Missing required field: monitor.slug');
    }
    if (!monitor.info || typeof monitor.info !== 'object') {
      errors.push('Missing required field: monitor.info');
    } else {
      const info = monitor.info as Record<string, unknown>;
      if (!info.name || typeof info.name !== 'string') {
        errors.push('Missing required field: monitor.info.name');
      }
      if (!info.about || typeof info.about !== 'string') {
        errors.push('Missing required field: monitor.info.about');
      }
    }
  }

  // Validate publisher section
  if (!c.publisher || typeof c.publisher !== 'object') {
    errors.push('Missing required field: publisher');
  } else {
    const publisher = c.publisher as Record<string, unknown>;
    if (!Array.isArray(publisher.relays)) {
      errors.push('Missing required field: publisher.relays (must be array)');
    } else {
      if (publisher.relays.length === 0) {
        errors.push('publisher.relays must contain at least one relay');
      }
      for (const relay of publisher.relays as string[]) {
        const err = validateRelayUrl(relay);
        if (err) {
          errors.push(`publisher.relays: ${err}`);
        }
      }
    }
  }

  // Validate relaymon section
  if (!c.relaymon || typeof c.relaymon !== 'object') {
    errors.push('Missing required field: relaymon');
  } else {
    const relaymon = c.relaymon as Record<string, unknown>;
    if (!Array.isArray(relaymon.networks)) {
      errors.push('Missing required field: relaymon.networks (must be array)');
    } else if (relaymon.networks.length === 0) {
      errors.push('relaymon.networks must contain at least one network');
    }

    if (!relaymon.seed || typeof relaymon.seed !== 'object') {
      errors.push('Missing required field: relaymon.seed');
    } else {
      const seed = relaymon.seed as Record<string, unknown>;
      if (!Array.isArray(seed.sources)) {
        errors.push('Missing required field: relaymon.seed.sources (must be array)');
      } else if (seed.sources.length === 0) {
        errors.push('relaymon.seed.sources must contain at least one source');
      }
    }
  }

  return errors;
}
