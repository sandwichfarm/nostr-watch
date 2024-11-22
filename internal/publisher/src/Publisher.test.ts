// tests/Publisher.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Publisher } from '../src/Publisher';
import wsAdapter from '@nostrwatch/publisher-nostrtools';

vi.mock('@nostrwatch/logger', () => ({
  default: class {
    warn = vi.fn();
  },
}));

vi.mock('@nostrwatch/publisher-nostrtools', () => ({
  default: class {
    publish = vi.fn().mockResolvedValue('published');
  },
}));

describe('Publisher Class', () => {
  const pubkey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const relays = ['wss://relay1.example.com', 'wss://relay2.example.com'];
  let publisher: Publisher;

  beforeEach(() => {
    publisher = new Publisher(pubkey, relays, { wsAdapter });
  });

  describe('Initialization', () => {
    it('should create an instance of Publisher', () => {
      expect(publisher).toBeInstanceOf(Publisher);
      expect(publisher.pubkey).toBe(pubkey);
      expect(publisher.relays).toEqual(relays);
      expect(publisher.logger).toBeDefined();
      expect(publisher.ws).toBeDefined();
    });
  });

  describe('publishEvent()', () => {
    it('should publish a signed event', async () => {
      const signedEvent = { id: 'event1', content: 'test event' };
      const result = await publisher.publishEvent(signedEvent);
      expect(result).toBe('published');
      expect(publisher.ws.publish).toHaveBeenCalledWith(signedEvent);
    });

    it('should handle errors during publish', async () => {
      const error = new Error('Publish failed');
      publisher.ws.publish = vi.fn().mockRejectedValue(error);
      const signedEvent = { id: 'event1', content: 'test event' };

      await publisher.publishEvent(signedEvent);
      expect(publisher.logger.warn).toHaveBeenCalledWith(
        `Publisher::publishEvent(): Error: ${error}`
      );
    });
  });

  describe('publishEvents()', () => {
    it('should publish multiple signed events', async () => {
      const signedEvents = [
        { id: 'event1', content: 'test event 1' },
        { id: 'event2', content: 'test event 2' },
      ];
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          for (const event of signedEvents) {
            yield event;
          }
        },
      };

      const result = await publisher.publishEvents(asyncIterable);
      expect(result).toEqual(['published', 'published']);
      expect(publisher.ws.publish).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during multiple publishes', async () => {
      const error = new Error('Publish failed');
      publisher.ws.publish = vi.fn().mockRejectedValue(error);
      const signedEvents = [
        { id: 'event1', content: 'test event 1' },
        { id: 'event2', content: 'test event 2' },
      ];
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          for (const event of signedEvents) {
            yield event;
          }
        },
      };

      const result = await publisher.publishEvents(asyncIterable);
      expect(result).toEqual([undefined, undefined]);
      expect(publisher.logger.warn).toHaveBeenCalledTimes(2);
    });
  });
});
