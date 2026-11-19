import { describe, expect, it } from 'vitest';

import { dedupeUrls } from './url';

describe('dedupeUrls', () => {
  it('keeps the first spelling of each relay', () => {
    expect(
      dedupeUrls([
        'wss://relay.nostr.watch',
        'wss://relaypag.es',
        'wss://relay.nostr.watch/',
        'wss://RELAY.nostr.watch',
        'wss://relaypag.es:443',
        'wss://relaypag.es',
      ])
    ).toEqual(['wss://relay.nostr.watch', 'wss://relaypag.es']);
  });

  it('keeps distinct paths and drops non-strings', () => {
    expect(dedupeUrls(['wss://a.example/one', 'wss://a.example/two', null, 42, 'not a url', 'not a url'])).toEqual([
      'wss://a.example/one',
      'wss://a.example/two',
      'not a url',
    ]);
  });
});
