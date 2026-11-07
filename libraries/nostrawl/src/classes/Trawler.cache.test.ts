import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open } from 'lmdb';
import { expect, it, vi } from 'vitest';
import NTTrawler from './Trawler';

it('counts only legacy markers without reading event payloads or changing the cache', async () => {
  const path = mkdtempSync(join(tmpdir(), 'nostrawl-count-'));
  const db = open({ path, compression: true });
  const trawler = new NTTrawler([]);
  trawler['cache'] = db;
  const keys = ['has', 'has:', 'has:a', 'has:b', 'has;', 'hat:a', 'event:large'];
  const largeEvent = { id: 'large', created_at: 123, tags: [['d', 'x'.repeat(256_000)]] };

  try {
    for (const key of keys) await db.put(key, largeEvent);
    const decode = vi.spyOn((db as any).decoder, 'decode').mockImplementation(() => {
      throw new Error('Counting must not decode event payloads');
    });

    try {
      expect(await trawler.countEvents('wss://relay.example')).toBe(3);
      expect(await trawler.countTimestamps('wss://relay.example')).toBe(3);
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }

    expect([...db.getKeys()]).toEqual(keys.sort());
    for (const key of keys) expect(db.get(key)).toEqual(largeEvent);
  } finally {
    await db.close();
    rmSync(path, { recursive: true, force: true });
  }
});
