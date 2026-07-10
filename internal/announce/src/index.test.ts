import { describe, it, expect } from 'vitest';
import { AnnounceMonitor } from './index'; // Adjust the import path based on your project structure

describe('AnnounceMonitor', () => {
  const pubkey = 'e771af0b05c8e95fcdf6feb3500544d2fb1ccd384788e9f490bb3ee28e8ed66f';
  const relays = ['wss://relay.example.com'];

  it('should throw an error if options are not correctly provided', () => {
    const options = {
      geo: 'invalid',
      relays,
    };
    expect(() => new AnnounceMonitor(pubkey, options as any)).toThrow("geo must be object");
  });

  it('should correctly set up instance properties from options', () => {
    const options = {
      geo: {},
      timeouts: { websocket: 1000 },
      networks: ['clearnet'],
      checks: ['websocket'],
      owner: 'testOwner',
      frequency: 'testFrequency',
      relays,
    };
    const monitor = new AnnounceMonitor(pubkey, options);
    expect(monitor.monReg.geo).toEqual(options.geo);
    expect(monitor.monReg.timeouts).toEqual(options.timeouts);
    expect(monitor.monReg.networks).toEqual(options.networks);
    expect(monitor.monReg.checks).toEqual(options.checks);
    expect(monitor.monReg.owner).toBe(options.owner);
    expect(monitor.monReg.frequency).toBe(options.frequency);
    expect(monitor.monRelays).toEqual(relays);
  });

  it('generate should return a valid event object', () => {
    const options = {
      geo: { lat: 10, lon: 20 },
      timeouts: { websocket: 1000 },
      networks: ['clearnet'],
      checks: ['websocket'],
      owner: 'testOwner',
      frequency: 'testFrequency',
      relays,
    };
    const monitor = new AnnounceMonitor(pubkey, options);
    const events = monitor.generate();
    expect(events).toHaveProperty('10166');
    expect(events).toHaveProperty('10002');
    expect(events["10166"].event.tags).toContainEqual(['frequency', 'testFrequency']);
    expect(events["10166"].event.tags).toContainEqual(['n', 'clearnet']);
    expect(events["10166"].event.tags).toContainEqual(['c', 'websocket']);
    expect(events["10166"].event.tags).toContainEqual(['timeout', 'websocket', '1000']);
  });
});
