import { assertEquals } from 'https://deno.land/std@0.218.2/assert/mod.ts';
import { getPublicKey, nip19 } from 'nostr-tools';
import { relaysFromRelayList } from './helpers.ts';
import { parseRelayList } from './parse.ts';
import { RelaySeeder } from './seeder.ts';
import { qualifyRelayUrl } from './sanitize.ts';
import { initDB } from '@nostrwatch/db';

const npub = nip19.npubEncode(getPublicKey(new Uint8Array(32).fill(1)));
const url = `ws://${npub}.fips:7777/inbox`;

for (const kind of [2, 3, 10002, 30002]) {
  Deno.test(`kind ${kind}: discovers and classifies a FIPS identity relay`, async () => {
    const event = {
      id: 'test', created_at: 1_700_000_000, kind,
      content: kind === 3 ? JSON.stringify({ [url]: { read: true } }) : url,
      tags: [[kind === 30002 ? 'relay' : 'r', url]],
    };
    assertEquals(await relaysFromRelayList(event), [
      { url, network: 'fips', online: null, ignore: false },
    ]);
    const rejected = `${url}/${npub}`;
    assertEquals(parseRelayList({
      ...event,
      content: kind === 3 ? JSON.stringify({ [rejected]: {} }) : rejected,
      tags: [[kind === 30002 ? 'relay' : 'r', rejected]],
    }), []);
  });
}

Deno.test('legacy sanitizer uses the same narrow FIPS hostname exception', () => {
  assertEquals(qualifyRelayUrl(url), true);
  assertEquals(qualifyRelayUrl(`${url}/${npub}`), false);
  assertEquals(qualifyRelayUrl(`ws://${npub}.fips.example.com`), false);
  assertEquals(qualifyRelayUrl(`ws://${npub}.example.com`), false);
});

Deno.test('seeding requires FIPS opt-in and keeps other networks separate', async () => {
  const db = initDB(':memory:', false);
  try {
    const config = [url, `${url}/${npub}`, 'wss://relay.example.com', 'ws://relay.onion', 'ws://relay.i2p'];
    for (const [allowedNetworks, expected] of [
      [['fips'], [url]],
      [['clearnet'], ['wss://relay.example.com/']],
      [['tor', 'i2p'], ['ws://relay.onion/', 'ws://relay.i2p/']],
      [[], ['wss://relay.example.com/']],
    ] as [string[], string[]][]) {
      const seeder = new RelaySeeder({ interval: 60_000, sources: ['config'], options: { allowedNetworks, config } });
      assertEquals(await seeder.seed(), expected);
    }
  } finally {
    db.close();
  }
});
