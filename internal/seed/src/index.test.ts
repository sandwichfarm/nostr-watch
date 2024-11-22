import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bootstrap,
  relaysFromEvents,
  relaysFromCache,
  relaysOnlineFromApi,
} from '../src/index';
import Logger from '@nostrwatch/logger';

vi.mock('@nostrwatch/logger', () => ({
  default: class {
    warn = vi.fn();
    err = vi.fn();
    debug = vi.fn();
  },
}));

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
    const mockLogger = Logger as unknown as { prototype: any };
    expect(mockLogger.prototype.warn).toHaveBeenCalledWith(
      'Skipping seed because there is no seed config'
    );
    expect(result).toEqual([[], {}]);
  });

});
