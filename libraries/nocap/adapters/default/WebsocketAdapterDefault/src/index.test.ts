import { describe, expect, it, vi } from 'vitest';
import type { Nocap } from '@nostrwatch/nocap';
import { UniversalWebSocket } from '@nostrwatch/websocket';
import WebsocketAdapterDefault from './index';

vi.mock('@nostrwatch/websocket', () => ({
  UniversalWebSocket: vi.fn(function () { return { on: vi.fn(), ready: async () => {} }; }),
}));

describe('host-routed transport', () => {
  it.each(['fips', 'i2p', 'clearnet', 'loki'])('opens %s without a proxy agent', async (network) => {
    vi.mocked(UniversalWebSocket).mockClear();
    const base = {
      url: `ws://relay.${network}:7777/nostr`, network,
      logger: { debug: vi.fn() }, on_error: vi.fn(),
    } as unknown as Nocap;
    await new WebsocketAdapterDefault(base).check_open();
    expect(UniversalWebSocket).toHaveBeenCalledExactlyOnceWith(base.url);
    expect(base.on_error).not.toHaveBeenCalled();
  });
});
