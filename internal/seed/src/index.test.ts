import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bootstrap,
  relaysFromEvents,
  relaysFromCache,
  relaysOnlineFromApi,
} from '../src/index';

vi.mock('@nostrwatch/utils', () => ({
  extractConfig: vi.fn(),
}));

vi.mock('cross-fetch', () => ({
  fetch: vi.fn(),
}));

describe('bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should warn and return empty when no opts', async () => {
    const mockExtractConfig = require('@nostrwatch/utils').extractConfig;
    mockExtractConfig.mockResolvedValue({});
    const result = await bootstrap('caller');
    expect(result).toEqual([[], {}]);
  });

});
