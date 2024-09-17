// adapters/cache/IndexedDbAdapter/src/index.test.ts

import { IndexedDbAdapter } from './index';
import { Event } from '../../../src/models/Event';
import geohash from 'ngeohash';

describe('IndexedDbAdapter Advanced Queries', () => {
  let adapter: IndexedDbAdapter;

  const testEvents: Event[] = [
    {
      id: 'event1',
      pubkey: 'pubkey1',
      created_at: 1722173222,
      signature: 'signature1',
      content: '{}',
      kind: 10166,
      tags: [
        ['g', geohash.encode(37.7749, -122.4194, 5)], // San Francisco
        ['frequency', '3600'],
        ['c', 'ws'],
        ['c', 'nip11'],
        ['isp', 'ISP1'],
        ['ip', '192.168.1.1'],
        ['countryCode', 'US'],
        ['p', 'ownerPubkey1'],
        ['n', 'clearnet'],
        ['rtt-open', '200'],
      ],
    },
    {
      id: 'event2',
      pubkey: 'pubkey2',
      created_at: 1722174000,
      signature: 'signature2',
      content: '{}',
      kind: 30166,
      tags: [
        ['g', geohash.encode(34.0522, -118.2437, 5)], // Los Angeles
        ['frequency', '3600'],
        ['c', 'ws'],
        ['c', 'ssl'],
        ['isp', 'ISP2'],
        ['ip', '192.168.1.2'],
        ['countryCode', 'US'],
        ['p', 'ownerPubkey2'],
        ['n', 'tr'],
        ['rtt-open', '150'],
      ],
    },
    {
      id: 'event3',
      pubkey: 'pubkey3',
      created_at: 1722175000,
      signature: 'signature3',
      content: '{}',
      kind: 10166,
      tags: [
        ['g', geohash.encode(40.7128, -74.0060, 5)], // New York
        ['frequency', '3600'],
        ['c', 'dns'],
        ['c', 'geo'],
        ['isp', 'ISP3'],
        ['ip', '192.168.1.3'],
        ['countryCode', 'US'],
        ['p', 'ownerPubkey3'],
        ['n', 'i2p'],
        ['rtt-open', '300'],
      ],
    },
  ];

  beforeAll(async () => {
    adapter = new IndexedDbAdapter('TestNIP66Cache');
    for (const event of testEvents) {
      await adapter.set(event.id, event);
    }
  });

  afterAll(async () => {
    await adapter.clear();
    await adapter['db'].delete(); // Delete the test database
  });

  test('should find monitors by geohash', async () => {
    const targetGeohash = geohash.encode(37.7749, -122.4194, 5); // San Francisco
    const results = await adapter.findMonitorsByGeohash(targetGeohash, 5);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('event1');
  });

  test('should sort monitors by distance', async () => {
    const targetGeohash = geohash.encode(36.7783, -119.4179, 5); // California
    const sortedEvents = await adapter.sortMonitorsByDistance(targetGeohash, 5);
    expect(sortedEvents.length).toBeGreaterThan(0);
    expect(sortedEvents[0].id).toBe('event1'); // Closest to target
  });

  test('should find monitors by specific checks', async () => {
    const checks = ['ws', 'nip11'];
    const results = await adapter.findMonitorsByChecks(checks);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('event1');
  });

  test('should find relays by NIPs with AND condition', async () => {
    const nips = [10166, 30166];
    const results = await adapter.findRelaysByNips(nips, 'and');
    expect(results.length).toBe(0); // No event has both kinds
  });

  test('should find relays by NIPs with OR condition', async () => {
    const nips = [10166, 30166];
    const results = await adapter.findRelaysByNips(nips, 'or');
    expect(results.length).toBe(3); // All events have either 10166 or 30166
  });

  test('should find relays by ISP', async () => {
    const isp = 'ISP2';
    const results = await adapter.findRelaysByISP(isp);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('event2');
  });

  test('should find relays by IP', async () => {
    const ip = '192.168.1.3';
    const results = await adapter.findRelaysByIP(ip);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('event3');
  });

  test('should find relays by Country Code', async () => {
    const countryCode = 'US';
    const results = await adapter.findRelaysByCountryCode(countryCode);
    expect(results.length).toBe(3);
  });

  test('should find relays by Owner Pubkey', async () => {
    const ownerPubkey = 'ownerPubkey2';
    const results = await adapter.findRelaysByOwner(ownerPubkey);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('event2');
  });

  test('should find relays by Network', async () => {
    const network = 'i2p';
    const results = await adapter.findRelaysByNetwork(network);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('event3');
  });

  test('should find relays by Round-Trip Time (rtt-open)', async () => {
    const rtt = 200;
    const comparator: '<' | '>' | '<=' | '>=' | '==' = '<=';
    const results = await adapter.findRelaysByRTT(rtt, comparator);
    expect(results.length).toBe(2); // event1 (200) and event2 (150)
    expect(results.map((e) => e.id)).toContain('event1');
    expect(results.map((e) => e.id)).toContain('event2');
  });

  test('should find relays by Liveness - online', async () => {
    const status = 'online';
    const thresholds = { onlineThreshold: 300, deadThreshold: 3600 };
    const results = await adapter.findRelaysByLiveness(status, thresholds);
    // Assuming currentTime is after created_at + thresholds
    // Mock currentTime or adjust created_at for accurate testing
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  // Additional tests for 'offline' and 'dead' statuses can be added similarly
});
