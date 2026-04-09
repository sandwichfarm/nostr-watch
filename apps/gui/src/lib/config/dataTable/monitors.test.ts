import { describe, it, expect, vi } from 'vitest';

// Mock the stores that access localStorage at module load time
vi.mock('$lib/stores/monitors.js', () => ({
  monitorsMap: { subscribe: vi.fn() }
}));

vi.mock('$lib/stores/nip05s.js', () => ({
  validNip05s: { subscribe: vi.fn() }
}));

import { tableFormatters } from './monitors';

describe('Count formatter: reportingOnline (DATA-02)', () => {
  const fmt = tableFormatters.reportingOnline;

  it('should render dash for null value', () => {
    const html = fmt(null, {});
    expect(html).toContain('-');
    expect(html).toContain('text-gray-500');
  });

  it('should render pending state when livenessFresh is false', () => {
    const html = fmt(5, { livenessFresh: false });
    expect(html).toContain('5');
    expect(html).toContain('text-gray-400');
    expect(html).toContain('animate-liveness-pulse');
    expect(html).toContain('liveness-pending');
    expect(html).not.toContain('text-green-400');
  });

  it('should render fresh state with green when livenessFresh is true and value > 0', () => {
    const html = fmt(5, { livenessFresh: true });
    expect(html).toContain('5');
    expect(html).toContain('text-green-400');
    expect(html).toContain('liveness-fresh');
    expect(html).not.toContain('animate-liveness-pulse');
  });

  it('should render fresh state with gray when livenessFresh is true and value is 0', () => {
    const html = fmt(0, { livenessFresh: true });
    expect(html).toContain('0');
    expect(html).toContain('text-gray-500');
    expect(html).toContain('liveness-fresh');
  });

  it('should render pending state when row is undefined', () => {
    const html = fmt(5, undefined);
    expect(html).toContain('5');
    expect(html).toContain('animate-liveness-pulse');
  });
});

describe('Count formatter: reportingOffline (DATA-02)', () => {
  const fmt = tableFormatters.reportingOffline;

  it('should render dash for null value', () => {
    const html = fmt(null, {});
    expect(html).toContain('-');
    expect(html).toContain('text-gray-500');
  });

  it('should render pending state when livenessFresh is false', () => {
    const html = fmt(3, { livenessFresh: false });
    expect(html).toContain('3');
    expect(html).toContain('text-gray-400');
    expect(html).toContain('animate-liveness-pulse');
    expect(html).toContain('liveness-pending');
  });

  it('should render fresh state with orange when livenessFresh is true and value > 0', () => {
    const html = fmt(3, { livenessFresh: true });
    expect(html).toContain('3');
    expect(html).toContain('text-orange-400');
    expect(html).toContain('liveness-fresh');
  });
});

describe('Count formatter: likelyDead (DATA-02)', () => {
  const fmt = tableFormatters.likelyDead;

  it('should render dash for null value', () => {
    const html = fmt(null, {});
    expect(html).toContain('-');
    expect(html).toContain('text-gray-500');
  });

  it('should render pending state when livenessFresh is false', () => {
    const html = fmt(2, { livenessFresh: false });
    expect(html).toContain('2');
    expect(html).toContain('text-gray-400');
    expect(html).toContain('animate-liveness-pulse');
    expect(html).toContain('liveness-pending');
  });

  it('should render fresh state with red when livenessFresh is true and value > 0', () => {
    const html = fmt(2, { livenessFresh: true });
    expect(html).toContain('2');
    expect(html).toContain('text-red-400');
    expect(html).toContain('liveness-fresh');
  });
});
