import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Nocap as Base } from '@nostrwatch/nocap';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cross-fetch', () => ({ default: fetchMock }));

import { DnsAdapterDefault } from './index';

describe('DnsAdapterDefault remote fetch policy', () => {
	beforeEach(() => {
		fetchMock.mockReset();
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ Answer: [{ data: '127.0.0.1' }] }), {
				headers: { 'content-type': 'application/dns-json' }
			})
		);
	});

	it('rejects redirects and omits ambient browser credentials', async () => {
		const base = {
			url: 'wss://relay.example',
			results: new Map([['network', 'clearnet']]),
			logger: { debug: vi.fn(), error: vi.fn() },
			finish: vi.fn()
		} as unknown as Base;

		await new DnsAdapterDefault(base).check_dns();

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('https://1.1.1.1/dns-query'),
			expect.objectContaining({
				redirect: 'error',
				credentials: 'omit',
				referrerPolicy: 'no-referrer',
				cache: 'no-store'
			})
		);
	});
});

describe('overlay DNS privacy', () => {
  it.each(['fips', 'tor', 'i2p', 'loki'])('never sends %s hostnames to public DoH', async (network) => {
    fetchMock.mockClear();
    const finish = vi.fn();
    const base = {
      url: `ws://relay.${network}:7777`,
      results: new Map([['network', network]]),
      logger: { debug: vi.fn() }, finish,
    } as unknown as Base;
    await new DnsAdapterDefault(base).check_dns();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledExactlyOnceWith('dns', expect.objectContaining({ status: 'error' }));
  });

  it('retains public DNS checks for clearnet', async () => {
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ json: async () => ({ Answer: [{ data: '192.0.2.1' }] }) } as Response);
    const finish = vi.fn();
    await new DnsAdapterDefault({
      url: 'wss://relay.example.org', results: new Map([['network', 'clearnet']]), finish,
    } as unknown as Base).check_dns();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(finish).toHaveBeenCalledWith('dns', expect.objectContaining({ status: 'success' }));
  });
});
