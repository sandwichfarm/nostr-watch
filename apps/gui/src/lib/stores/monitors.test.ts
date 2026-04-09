import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';

// -- Active detection logic tests (pure function) --
// This function replicates the expected formula from monitorRows derivation.
// Plan 01 must implement row.active using this exact formula.
function computeActive(lastActive: number, frequency: number, leniency: number, now: number): boolean {
  return typeof lastActive === "number" && lastActive > 0
    && typeof frequency === "number" && frequency > 0
    ? now - (frequency * leniency) < lastActive
    : false;
}

describe('Active detection with leniency (DATA-01)', () => {
  const NOW = 1000;

  it('should mark monitor active when within frequency * leniency window', () => {
    // lastActive=900, frequency=100, leniency=1.0: 1000 - (100*1.0) = 900, 900 < 900 is false
    // Actually at exact boundary, should be inactive (strict <)
    expect(computeActive(900, 100, 1.0, NOW)).toBe(false);
    // lastActive=901: 1000 - 100 = 900 < 901 is true
    expect(computeActive(901, 100, 1.0, NOW)).toBe(true);
  });

  it('should use leniency multiplier to extend the active window', () => {
    // lastActive=890, frequency=100, leniency=1.2: 1000 - (100*1.2) = 880 < 890 = true
    expect(computeActive(890, 100, 1.2, NOW)).toBe(true);
    // Same scenario without leniency (1.0): 1000 - 100 = 900 < 890 = false
    expect(computeActive(890, 100, 1.0, NOW)).toBe(false);
  });

  it('should handle leniency=2.0 (max allowed)', () => {
    // lastActive=810, frequency=100, leniency=2.0: 1000 - 200 = 800 < 810 = true
    expect(computeActive(810, 100, 2.0, NOW)).toBe(true);
    // Without max leniency: 1000 - 100 = 900 < 810 = false
    expect(computeActive(810, 100, 1.0, NOW)).toBe(false);
  });

  it('should return false when lastActive is -1 (missing)', () => {
    expect(computeActive(-1, 100, 1.2, NOW)).toBe(false);
  });

  it('should return false when lastActive is 0', () => {
    expect(computeActive(0, 100, 1.2, NOW)).toBe(false);
  });

  it('should return false when frequency is 0', () => {
    expect(computeActive(999, 0, 1.2, NOW)).toBe(false);
  });
});

describe('monitorFreshness store (DATA-02)', () => {
  // These tests import the actual store — they will fail until Plan 01 creates the exports
  it('should initialize as an empty Set', async () => {
    const { monitorFreshness } = await import('./monitors');
    const value = get(monitorFreshness);
    expect(value).toBeInstanceOf(Set);
    expect(value.size).toBe(0);
  });

  it('should add pubkeys via markMonitorsFresh', async () => {
    const { monitorFreshness, markMonitorsFresh } = await import('./monitors');
    // Reset to empty for this test
    monitorFreshness.set(new Set());
    markMonitorsFresh(['pk1', 'pk2']);
    const value = get(monitorFreshness);
    expect(value.has('pk1')).toBe(true);
    expect(value.has('pk2')).toBe(true);
    expect(value.size).toBe(2);
    // Cleanup
    monitorFreshness.set(new Set());
  });

  it('should create a new Set reference on update (Svelte reactivity)', async () => {
    const { monitorFreshness, markMonitorsFresh } = await import('./monitors');
    monitorFreshness.set(new Set());
    const before = get(monitorFreshness);
    markMonitorsFresh(['pk1']);
    const after = get(monitorFreshness);
    expect(before).not.toBe(after); // Different object reference
    // Cleanup
    monitorFreshness.set(new Set());
  });

  it('should be idempotent — adding same pubkey twice does not duplicate', async () => {
    const { monitorFreshness, markMonitorsFresh } = await import('./monitors');
    monitorFreshness.set(new Set());
    markMonitorsFresh(['pk1']);
    markMonitorsFresh(['pk1']);
    const value = get(monitorFreshness);
    expect(value.size).toBe(1);
    // Cleanup
    monitorFreshness.set(new Set());
  });
});

describe('livenessFresh derivation logic (DATA-02)', () => {
  it('should be false when pubkey is not in freshness Set', () => {
    const freshSet = new Set<string>();
    expect(freshSet.has('pk1')).toBe(false);
  });

  it('should be true when pubkey is in freshness Set', () => {
    const freshSet = new Set<string>(['pk1', 'pk2']);
    expect(freshSet.has('pk1')).toBe(true);
    expect(freshSet.has('pk2')).toBe(true);
    expect(freshSet.has('pk3')).toBe(false);
  });
});
