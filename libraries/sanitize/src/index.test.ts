import { describe, it, expect } from 'vitest';
import { isLocal, isLocalNet, normalizeRelays, qualifyRelayUrl, sanitizeRelayUrl } from './index';

describe('Utility Functions', () => {

  describe('isLocal', () => {
    it('should return true for local file URLs', () => {
      expect(isLocal("file:///C:/path/to/file.txt")).toBe(true);
    });

    it('should return true for local network paths', () => {
      expect(isLocal("\\\\networkpath\\to\\file")).toBe(true);
    });

    it('should return false for non-local URLs', () => {
      expect(isLocal("http://example.com")).toBe(false);
    });

    it('should return null for non-string inputs', () => {
      expect(isLocal(12345 as unknown as string)).toBe(null);
    });

    it('should return true for invalid URL strings', () => {
      expect(isLocal("invalid-url")).toBe(true);
    });
  });

  describe('isLocalNet', () => {
    it('should return true for loopback addresses', () => {
      expect(isLocalNet("http://127.0.0.1")).toBe(true);
    });

    it('should return true for private network addresses', () => {
      expect(isLocalNet("http://192.168.1.1")).toBe(true);
      expect(isLocalNet("http://10.0.0.1")).toBe(true);
      expect(isLocalNet("http://172.16.0.1")).toBe(true);
    });

    it('should return false for public IP addresses', () => {
      expect(isLocalNet("http://8.8.8.8")).toBe(false);
    });

    it('should return false for invalid URL strings', () => {
      expect(isLocalNet("invalid-url")).toBe(false);
    });
  });

  describe('normalizeRelays', () => {
    it('should normalize and filter relay URLs', () => {
      const relays = ["wss://example.com", "ws://another.com"];
      const normalizedRelays = normalizeRelays(relays);
      expect(normalizedRelays).toEqual(["wss://example.com/", "ws://another.com/"]);
    });
  });

  // describe('sanitizeRelayList', () => {
  //   it('should sanitize relay URLs', () => {
  //     const relays = ["ws://invalid", "wss://example.com", "http://blocked.com"];
  //     const sanitizedRelays = sanitizeRelayList(relays);
  //     expect(sanitizedRelays).toEqual(["wss://example.com"]);
  //   });
  // });

  describe('qualifyRelayUrl', () => {
    it('should return true for qualified relay URLs', () => {
      expect(qualifyRelayUrl("wss://example.com")).toBe(true);
    });

    it('should return false for unqualified relay URLs', () => {
      expect(qualifyRelayUrl("http://example.com")).toBe(false);
      expect(qualifyRelayUrl("wss://localhost")).toBe(false);
      expect(qualifyRelayUrl("ws://127.0.0.1")).toBe(false);
    });
  });

  describe('sanitizeRelayUrl', () => {
    it('should sanitize relay URL', () => {
      expect(sanitizeRelayUrl(" wss://example.com   ")).toBe("wss://example.com/");
    });

    it('should return empty string for invalid URLs', () => {
      expect(sanitizeRelayUrl("invalid-url")).toBe("");
    });
  });

});
