import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Publisher } from '../src/Publisher';
import wsAdapter from '@nostrwatch/publisher-nostrtools';

vi.mock('@nostrwatch/logger', () => ({
  default: class {
    warn = vi.fn();
  },
}));

vi.mock('nostr-tools', () => ({
  SimplePool: class {
    publish() {
      return Promise.resolve('published');
    }
  }
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
      expect(publisher.pool).toBeDefined();
    });
  });

  describe('publishEvent()', () => {
    it('should publish a signed event', async () => {
      publisher.pool.publish = vi.fn().mockResolvedValue('published');
      
      const signedEvent = { id: 'event1', content: 'test event' };
      const result = await publisher.publishEvent(signedEvent);
      expect(result).toBe('published');
      expect(publisher.pool.publish).toHaveBeenCalledWith(relays, signedEvent);
    });

    it('should propagate errors during publish', async () => {
      const error = new Error('Publish failed');
      publisher.pool.publish = vi.fn().mockRejectedValue(error);
      const signedEvent = { id: 'event1', content: 'test event' };

      await expect(publisher.publishEvent(signedEvent)).rejects.toThrow(error);
      expect(publisher.pool.publish).toHaveBeenCalledWith(relays, signedEvent);
    });
  });

  describe('publishEvents()', () => {
    it('should publish multiple events', async () => {
      const publishEventSpy = vi.spyOn(publisher, 'publishEvent')
        .mockResolvedValueOnce('published1')
        .mockResolvedValueOnce('published2');
      
      const signedEvents = [
        { id: 'event1', content: 'test event 1' },
        { id: 'event2', content: 'test event 2' }
      ];
      
      const result = await publisher.publishEvents((async function* () {
        for (const event of signedEvents) {
          yield event;
        }
      })());
      
      expect(result).toEqual(['published1', 'published2']);
      expect(publishEventSpy).toHaveBeenCalledTimes(2);
      expect(publishEventSpy).toHaveBeenCalledWith(signedEvents[0]);
      expect(publishEventSpy).toHaveBeenCalledWith(signedEvents[1]);
    });
  });
});
