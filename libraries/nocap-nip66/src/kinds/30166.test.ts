// Kind30166.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Kind30166 } from './30166';
import ngeotags from 'nostr-geotags';

vi.mock('nostr-geotags', () => ({
  default: vi.fn(),
}));

describe('Kind30166', () => {
  const pubkey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  let kind30166: Kind30166;

  beforeEach(() => {
    kind30166 = new Kind30166(pubkey);
  });

  describe('Initialization', () => {
    it('should create an instance of Kind30166', () => {
      expect(kind30166).toBeInstanceOf(Kind30166);
      expect(kind30166.kind).toBe(30166);
    });
  });

  describe('generateEvent()', () => {
    it('should generate event with empty content if no nip11 data', () => {
      const checkData = {
        url: 'wss://example.com',
      };
      const event = kind30166.generateEvent(checkData);
      expect(event.content).toBe('{}');
      expect(event.tags).toBeDefined();
      expect(event.tags.length).toBeGreaterThan(0);
    });

    it('should generate event with nip11 content', () => {
      const nip11Data = { name: 'Test NIP11' };
      const checkData = {
        url: 'wss://example.com',
        info: { data: nip11Data },
      };
      const event = kind30166.generateEvent(checkData);
      expect(event.content).toBe(JSON.stringify(nip11Data));
    });
  });

  describe('generateTags()', () => {
    it('should add basic tags correctly', () => {
      const checkData = {
        url: 'wss://example.com',
        open: { duration: 100.5 },
        read: { duration: 200 },
        write: { duration: 300 },
      };
      const tags = kind30166.generateTags(checkData);
      expect(tags).toContainEqual(['d', 'wss://example.com']);
      expect(tags).toContainEqual(['rtt-open', '101']);
      expect(tags).toContainEqual(['rtt-read', '200']);
      expect(tags).toContainEqual(['rtt-write', '300']);
    });

    it('should add network tag if present', () => {
      const checkData = {
        url: 'wss://example.com',
        network: 'mainnet',
      };
      const tags = kind30166.generateTags(checkData);
      expect(tags).toContainEqual(['n', 'mainnet']);
    });

    describe('Info Tags', () => {
      it('should handle info tags correctly', () => {
        const infoData = {
          pubkey: pubkey,
          supported_nips: [1, 2],
          language_tags: ['en', 'es'],
          tags: ['tag1', 'tag2'],
          limitation: { auth_required: true, payment_required: false },
          software: 'TestSoftware',
          version: '1.0.0',
        };
        const checkData = {
          url: 'wss://example.com',
          info: { data: infoData },
        };
        const tags = kind30166.generateTags(checkData);

        expect(tags).toContainEqual(['p', pubkey]);
        expect(tags).toContainEqual(['N', '1']);
        expect(tags).toContainEqual(['N', '2']);
        expect(tags).toContainEqual(['L', 'ISO-639-1']);
        expect(tags).toContainEqual(['l', 'en', 'ISO-639-1']);
        expect(tags).toContainEqual(['l', 'es', 'ISO-639-1']);
        expect(tags).toContainEqual(['t', 'tag1']);
        expect(tags).toContainEqual(['t', 'tag2']);
        expect(tags).toContainEqual(['R', 'auth']);
        expect(tags).toContainEqual(['R', '!payment']);
        expect(tags).toContainEqual(['s', 'TestSoftware']);
        expect(tags).toContainEqual(['L', 'nip11.version']);
        expect(tags).toContainEqual(['l', '1.0.0', 'nip11.version']);
      });
    });

    describe('SSL Tags', () => {
      it('should handle SSL tags correctly for wss protocol', () => {
        const sslData = {
          valid_from: new Date(Date.now() - 100000).toISOString(),
          valid_to: new Date(Date.now() + 100000).toISOString(),
        };
        const checkData = {
          url: 'wss://example.com',
          ssl: { data: sslData },
        };
        const tags = kind30166.generateTags(checkData);
        expect(tags).toContainEqual(['R', 'ssl']);
      });

      it('should handle SSL tags correctly for non-wss protocol', () => {
        const checkData = {
          url: 'ws://example.com',
        };
        const tags = kind30166.generateTags(checkData);
        expect(tags).toContainEqual(['R', '!ssl']);
      });
    });

    describe('DNS Tags', () => {
      it('should handle DNS tags correctly', () => {
        const dnsData = {
          ipv4: ['192.168.1.1'],
          ipv6: ['::1'],
        };
        const checkData = {
          url: 'wss://example.com',
          dns: { data: dnsData },
        };
        const tags = kind30166.generateTags(checkData);

        expect(tags).toContainEqual(['L', 'dns.ipv4']);
        expect(tags).toContainEqual(['l', '192.168.1.1', 'dns.ipv4']);
        expect(tags).toContainEqual(['L', 'dns.ipv6']);
        expect(tags).toContainEqual(['l', '::1', 'dns.ipv6']);
      });
    });

    describe('Geo Tags', () => {
      it('should handle geo tags correctly', () => {
        const geoData = [
          {
            isp: 'Test ISP',
            as: 'AS12345',
            asname: 'Test AS Name',
            countryCode: 'US',
            countryName: 'United States',
            regionCode: 'CA',
          },
        ];
        const checkData = {
          url: 'wss://example.com',
          geo: { data: geoData },
        };

        // Mock ngeotags response
        const mockNgeotags = ngeotags as any;
        mockNgeotags.mockReturnValue([
          ['L', 'geo'],
          ['l', 'US', 'geo'],
        ]);

        const tags = kind30166.generateTags(checkData);

        expect(tags).toContainEqual(['L', 'host.isp']);
        expect(tags).toContainEqual(['l', 'Test ISP', 'host.isp']);
        expect(tags).toContainEqual(['L', 'host.as']);
        expect(tags).toContainEqual(['l', 'AS12345', 'host.as']);
        expect(tags).toContainEqual(['L', 'host.asn']);
        expect(tags).toContainEqual(['l', 'Test AS Name', 'host.asn']);
        expect(tags).toContainEqual(['L', 'geo']);
        expect(tags).toContainEqual(['l', 'US', 'geo']);
      });
    });

    describe('Label Deduplication', () => {
      it('should deduplicate labels correctly', () => {
        const tags = [
          ['L', 'label1'],
          ['l', 'value1', 'label1'],
          ['l', 'value2', 'label1'],
          ['l', 'value1', 'label1'], // Duplicate
          ['L', 'label2'],
          ['l', 'value3', 'label2'],
        ];
        const dedupedTags = kind30166.dedupLabels(tags);
        expect(dedupedTags).toEqual([
          ['L', 'label1'],
          ['l', 'value1', 'label1'],
          ['l', 'value2', 'label1'],
          ['L', 'label2'],
          ['l', 'value3', 'label2'],
        ]);
      });
    });
  });
});
