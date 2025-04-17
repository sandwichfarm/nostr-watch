import { describe, it, expect, vi } from 'vitest';
import { load } from './+page';

// Mock the error function
vi.mock('@sveltejs/kit', () => ({
  error: vi.fn((status, data) => {
    throw { status, ...data };
  })
}));

describe('Protocol validation', () => {
  it('should pass for ws protocol', () => {
    const result = load({ params: { protocol: 'ws' } } as any);
    expect(result).toEqual({ protocol: 'ws' });
  });

  it('should pass for wss protocol', () => {
    const result = load({ params: { protocol: 'wss' } } as any);
    expect(result).toEqual({ protocol: 'wss' });
  });

  it('should throw an error for invalid protocols', () => {
    // Test for http protocol
    expect(() => load({ params: { protocol: 'http' } } as any))
      .toThrow();
    
    // Test for https protocol
    expect(() => load({ params: { protocol: 'https' } } as any))
      .toThrow();
    
    // Test for other invalid protocols
    expect(() => load({ params: { protocol: 'ftp' } } as any))
      .toThrow();
  });

  it('should include the protocol in the error message', () => {
    try {
      load({ params: { protocol: 'http' } } as any);
    } catch (error: any) {
      expect(error.message).toContain('http');
      expect(error.message).toContain('Only \'ws\' and \'wss\' are supported');
    }
  });
}); 