// Transform.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Transform } from './Transform';

// Mock dependencies if necessary
vi.mock('@nostrwatch/logger', () => ({
  Logger: class {
    err = vi.fn();
    info = vi.fn();
    warn = vi.fn();
  },
}));

vi.mock('nostr-tools', () => ({
  getEventHash: vi.fn().mockReturnValue('mocked_event_hash'),
}));

describe('Transform Class', () => {
  const pubkey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  let baseInstance: Transform;

  // Create a concrete subclass for testing
  class TestBase extends Transform {
    constructor(kind: number, pubkey: string) {
      super(kind, pubkey);
    }

    generateTags(check: any): string[][] {
      // Minimal implementation for testing
      return [['tag1', 'value1'], ['tag2', 'value2']];
    }
  }

  beforeEach(() => {
    baseInstance = new TestBase(9999, pubkey);
  });

  describe('Initialization', () => {
    it('should create an instance of Transform', () => {
      expect(baseInstance).toBeInstanceOf(Transform);
      expect(baseInstance.kind).toBe(9999);
      expect(baseInstance.pubkey).toBe(pubkey);
      expect(baseInstance.logger).toBeDefined();
    });

    it('should throw an error if kind is undefined', () => {
      expect(() => new TestBase(undefined as unknown as number, pubkey)).toThrow(
        'Kind must be defined'
      );
    });

    it('should throw an error if pubkey is undefined', () => {
      expect(() => new TestBase(9999, undefined as unknown as string)).toThrow(
        'DAEMON_PUBKEY must be defined'
      );
    });
  });

  describe('tpl()', () => {
    it('should return a template with default values', () => {
      const tpl = baseInstance.tpl();
      expect(tpl).toEqual({
        id: null,
        pubkey,
        kind: 9999,
        created_at: expect.any(Number),
        tags: [],
        content: '',
      });
    });

    it('should include data if provided', () => {
      const data = {
        checked_at: 1620000000,
        content: 'Test Content',
        tags: [['test', 'tag']],
      };
      const tpl = baseInstance.tpl(data);
      expect(tpl).toEqual({
        id: null,
        pubkey,
        kind: 9999,
        created_at: 1620000000,
        tags: [['test', 'tag']],
        content: 'Test Content',
      });
    });
  });

  describe('generateEvent()', () => {
    it('should generate an event with correct properties', () => {
      const data = {
        url: 'wss://example.com',
        info: { data: { key: 'value' } },
      };
      const event = baseInstance.generateEvent(data);
      expect(event.id).toBe('mocked_event_hash');
      expect(event.pubkey).toBe(pubkey);
      expect(event.kind).toBe(9999);
      expect(event.created_at).toBeGreaterThan(0);
      expect(event.tags).toEqual([['tag1', 'value1'], ['tag2', 'value2']]);
      expect(event.content).toBe(JSON.stringify({ key: 'value' }));
    });

    it('should handle errors in content serialization', () => {
      const data = {
        url: "wss://someurl.xyz",
        info: { data: undefined },
      };
      // Simulate error in JSON.stringify
      const originalStringify = JSON.stringify;
      JSON.stringify = () => {
        throw new Error('Serialization error');
      };

      const event = baseInstance.generateEvent(data);
      expect(event.content).toBe('{}');
      // Restore JSON.stringify
      JSON.stringify = originalStringify;
    });
  });

  describe('dedupLabels()', () => {
    it('should deduplicate labels correctly', () => {
      const tags = [
        ['L', 'label1'],
        ['l', 'value1', 'label1'],
        ['l', 'value2', 'label1'],
        ['l', 'value1', 'label1'], // Duplicate
        ['L', 'label2'],
        ['l', 'value3', 'label2'],
      ];
      const dedupedTags = baseInstance.dedupLabels(tags);
      expect(dedupedTags).toEqual([
        ['L', 'label1'],
        ['l', 'value1', 'label1'],
        ['l', 'value2', 'label1'],
        ['L', 'label2'],
        ['l', 'value3', 'label2'],
      ]);
    });
  });

  describe('removeLabels()', () => {
    it('should remove labels correctly', () => {
      const tags = [
        ['L', 'label1'],
        ['l', 'value1', 'label1'],
        ['t', 'tag1'],
        ['l', 'value2', 'label1'],
        ['L', 'label2'],
        ['p', 'pubkey'],
      ];
      const filteredTags = baseInstance.removeLabels(tags);
      expect(filteredTags).toEqual([
        ['t', 'tag1'],
        ['p', 'pubkey'],
      ]);
    });
  });

  describe('json()', () => {
    it('should return the current event', () => {
      const data = {
        url: 'wss://example.com',
      };
      baseInstance.generateEvent(data);
      const event = baseInstance.json();
      expect(event).toBeDefined();
      expect(event.id).toBe('mocked_event_hash');
    });
  });
});
