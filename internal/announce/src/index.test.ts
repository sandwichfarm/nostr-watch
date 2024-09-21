import { describe, it, expect } from 'vitest';
import { AnnounceMonitor } from './index'; // Adjust the import path based on your project structure

describe('AnnounceMonitor', () => {
  it('should throw an error if options are not correctly provided', () => {
    const options = {
      geo: null, // Invalid type for testing purposes
    };
    expect(() => new AnnounceMonitor(options as any)).toThrow("geo must be object");
  });

  it('should correctly set up instance properties from options', () => {
    const options = {
      geo: {},
      kinds: [1, 2],
      timeouts: [1000, 2000],
      counts: [10, 20],
      owner: 'testOwner',
      frequency: 'testFrequency',
    };
    const monitor = new AnnounceMonitor(options);
    expect(monitor).toHaveProperty('geo', options.geo);
    expect(monitor).toHaveProperty('kinds', options.kinds);
    expect(monitor).toHaveProperty('timeouts', options.timeouts);
    expect(monitor).toHaveProperty('counts', options.counts);
    expect(monitor).toHaveProperty('owner', options.owner);
    expect(monitor).toHaveProperty('frequency', options.frequency);
  });

  it('generate should return a valid event object', () => {
    const pubkey = "e771af0b05c8e95fcdf6feb3500544d2fb1ccd384788e9f490bb3ee28e8ed66f"
    const options = {
      geo: { lat: 10, lon: 20 },
      kinds: [1],
      timeouts: [1000],
      counts: [10],
      owner: 'testOwner',
      frequency: 'testFrequency',
    };
    const monitor = new AnnounceMonitor(options, pubkey);
    const events = monitor.generate();
    expect(events).toHaveProperty('kind');
    expect(events["10166"].tags).toContainEqual(['frequency', 'testFrequency']);
    expect(events["10166"].tags).toContainEqual(['owner', 'testOwner']);
    expect(events["10166"].tags).toContainEqual(['k', '1']);
    expect(events["10166"].tags).toContainEqual(['c', '10']);
    expect(events["10166"].tags).toContainEqual(['timeout', '1000']);
    // Assuming ngeotags function returns an array of geotags based on the provided geo object
  });
});
