import type { IEvent } from '@nostrwatch/route66/models';
import { StateManager } from '@nostrwatch/route66';

import {
  CacheAdapter,
  type ICacheAdapter,
  WebsocketAdapter,
  type SubscribeHandlers,
  type WebsocketRequestBody,
  type IWebsocketAdapter,
  defaultWebsocketAdapterOptions,
} from '@nostrwatch/route66/core';

import { deterministicHash } from '@nostrwatch/route66/utils';

import { getLeaderTabRpcClient } from './leader-tab-client';
import type { LeaderTabRpcOp, LeaderTabRpcOpMap } from './leader-tab-protocol';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function leaderCall<K extends LeaderTabRpcOp>(
  op: K,
  args: LeaderTabRpcOpMap[K]['args'],
  timeoutMs = 30_000
): Promise<LeaderTabRpcOpMap[K]['result']> {
  const client = getLeaderTabRpcClient();
  const delays = [0, 50, 150, 400];

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (attempt > 0) {
      await sleep(delays[attempt]);
    }

    try {
      return await client.call(op, args, { timeoutMs });
    } catch (e) {
      lastError = e;
      try {
        await client.waitForLeader({ timeoutMs: 2_500 });
      } catch {
        // ignore; next retry handles it
      }
    }
  }

  throw lastError ?? new Error(`Leader RPC failed: ${op}`);
}

async function leaderCallStream<K extends LeaderTabRpcOp>(
  op: K,
  args: LeaderTabRpcOpMap[K]['args'],
  requestId: string,
  onStream: (msg: any) => void,
  timeoutMs: number,
  autoCloseOnResponse: boolean
): Promise<LeaderTabRpcOpMap[K]['result']> {
  const client = getLeaderTabRpcClient();
  const delays = [0, 50, 150, 400];

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (attempt > 0) {
      await sleep(delays[attempt]);
    }

    try {
      return await client.callStream(op, args, {
        requestId,
        timeoutMs,
        autoCloseOnResponse,
        onStream: onStream as any,
      });
    } catch (e) {
      lastError = e;
      try {
        await client.waitForLeader({ timeoutMs: 2_500 });
      } catch {
        // ignore; next retry handles it
      }
    }
  }

  throw lastError ?? new Error(`Leader stream RPC failed: ${op}`);
}

export class TabClientCacheAdapter extends CacheAdapter implements ICacheAdapter {
  readonly slug: string = 'tab-client-cache';
  useWorker: boolean = false;
  handleSetupInternally: boolean = true;

  // Route66.Workers will still assign `workers`; this avoids noisy warnings.
  protected bindWorkerHandlers(): void {}

  async newWorker(): Promise<Worker | SharedWorker> {
    throw new Error('TabClientCacheAdapter does not spawn workers');
  }

  async ready(): Promise<void> {
    return;
  }

  async abort(): Promise<boolean> {
    return true;
  }

  async shutdown(): Promise<void> {
    return;
  }

  async REQ(filters: any[]): Promise<IEvent[]> {
    return (await leaderCall('cache.REQ', [filters])) as IEvent[];
  }

  async COUNT(filters: any[]): Promise<number> {
    return (await leaderCall('cache.COUNT', [filters])) as number;
  }

  async DELETE(filters: any[]): Promise<string[]> {
    return (await leaderCall('cache.DELETE', [filters])) as string[];
  }

  async DUMP(): Promise<Uint8Array> {
    return (await leaderCall('cache.DUMP', [])) as Uint8Array;
  }

  async CLOSE(subId: string): Promise<boolean> {
    return (await leaderCall('cache.CLOSE', [subId])) as boolean;
  }

  async WIPE(): Promise<boolean> {
    return (await leaderCall('cache.WIPE', [])) as boolean;
  }

  async addEvent(event: IEvent): Promise<void> {
    await leaderCall('cache.addEvent', [event]);
  }

  async addEvents(events: IEvent[]): Promise<void> {
    await leaderCall('cache.addEvents', [events]);
  }

  async putEvent(event: IEvent): Promise<void> {
    await leaderCall('cache.putEvent', [event]);
  }

  async upsertNip11(relay: string, nip11: any): Promise<void> {
    await leaderCall('cache.upsertNip11', [relay, nip11]);
  }

  async batchUpsertNip11(relayNip11s: { relay: string; nip11: any }[]): Promise<boolean> {
    return (await leaderCall('cache.batchUpsertNip11', [relayNip11s])) as boolean;
  }

  async countNip11s(): Promise<number> {
    return (await leaderCall('cache.countNip11s', [])) as number;
  }

  async countUniqueNip11s(): Promise<number> {
    return (await leaderCall('cache.countUniqueNip11s', [])) as number;
  }

  async getNip11(relay: any): Promise<any> {
    return await leaderCall('cache.getNip11', [relay]);
  }
}

export class TabClientWebsocketAdapter extends WebsocketAdapter implements IWebsocketAdapter {
  readonly slug: string = 'tab-client-websocket';
  useWorker: boolean = false;
  handleSetupInternally: boolean = true;

  private readonly keepAliveSubs = new Map<
    string,
    { args: WebsocketRequestBody; callbacks?: SubscribeHandlers }
  >();
  private stopLeaderMonitor: (() => void) | null = null;
  private stopLeaderListener: (() => void) | null = null;
  private readonly destroyListener: () => void;

  private resubscribeInFlight: Promise<void> | null = null;

  constructor() {
    super();
    this.destroyListener = this.cleanup.bind(this);
    try {
      StateManager.on('destroy', this.destroyListener);
    } catch {}
  }

  protected bindWorkerHandlers(): void {}

  async newWorker(): Promise<Worker | SharedWorker> {
    throw new Error('TabClientWebsocketAdapter does not spawn workers');
  }

  async ready(): Promise<void> {
    return;
  }

  async connect(): Promise<void> {
    return;
  }

  disconnect(): void {}
  terminate(): void {}

  async shutdown(): Promise<void> {
    this.cleanup();
  }

  private ensureLeaderMonitoring() {
    const client = getLeaderTabRpcClient();

    if (!this.stopLeaderMonitor) {
      this.stopLeaderMonitor = client.startLeaderMonitor({ pollMs: 2000, timeoutMs: 750 });
    }

    if (!this.stopLeaderListener) {
      this.stopLeaderListener = client.onLeaderChange((info) => {
        if (!info) return;
        void this.resubscribeKeepAlive().catch(() => {});
      });
    }
  }

  private stopLeaderMonitoringIfIdle() {
    if (this.keepAliveSubs.size > 0) return;
    this.stopLeaderListener?.();
    this.stopLeaderListener = null;
    this.stopLeaderMonitor?.();
    this.stopLeaderMonitor = null;
  }

  private async resubscribeKeepAlive() {
    if (this.resubscribeInFlight) return this.resubscribeInFlight;

    this.resubscribeInFlight = (async () => {
      for (const [hash, entry] of this.keepAliveSubs.entries()) {
        const args = entry.args;
        args.hash = hash;
        args.options = {
          ...defaultWebsocketAdapterOptions,
          ...(args.options ?? {}),
          stream: true,
          keepAlive: true,
        };
        try {
          await this.streamWs('ws.subscribe', args, entry.callbacks);
        } catch {
          // best-effort; will retry on next leader change
        }
      }
    })().finally(() => {
      this.resubscribeInFlight = null;
    });

    return this.resubscribeInFlight;
  }

  private ensureHash(args: WebsocketRequestBody): string {
    if (args.hash) return args.hash;
    // Match existing adapter behavior (best-effort): stable hash based on filters.
    args.hash = deterministicHash(args.filters ?? {});
    return args.hash;
  }

  private async streamWs(
    op: 'ws.fetch' | 'ws.subscribe',
    args: WebsocketRequestBody,
    callbacks?: SubscribeHandlers
  ): Promise<IEvent[] | boolean> {
    const hash = this.ensureHash(args);
    const keepAlive = Boolean(args?.options?.keepAlive);

    const onStream = (msg: { kind: string; data?: any }) => {
      if (msg.kind === 'events') {
        const events = msg.data as IEvent[];
        callbacks?.onevents?.(events);
        if (callbacks?.onevent) events.forEach((e) => callbacks.onevent?.(e));
      } else if (msg.kind === 'event') {
        callbacks?.onevent?.(msg.data);
      } else if (msg.kind === 'eose') {
        callbacks?.oneose?.();
      } else if (msg.kind === 'close') {
        callbacks?.onclose?.(msg.data);
      }
    };

    return (await leaderCallStream(
      op,
      [args],
      hash,
      onStream as any,
      30_000,
      !keepAlive
    )) as IEvent[] | boolean;
  }

  async publish(args: Partial<WebsocketRequestBody>): Promise<boolean> {
    return (await leaderCall('ws.publish', [args])) as boolean;
  }

  async subscribe(
    args: WebsocketRequestBody,
    callbacks?: SubscribeHandlers
  ): Promise<IEvent[] | boolean> {
    if (callbacks && Object.keys(callbacks).length > 0) {
      args.options = { ...defaultWebsocketAdapterOptions, ...(args.options ?? {}), stream: true };
      const hash = this.ensureHash(args);
      if (args?.options?.keepAlive) {
        this.keepAliveSubs.set(hash, { args, callbacks });
        this.ensureLeaderMonitoring();
      }
      return this.streamWs('ws.subscribe', args, callbacks);
    }
    this.ensureHash(args);
    if (args?.options?.keepAlive) {
      // keepAlive subscriptions without callbacks would hang in the leader's underlying adapter.
      throw new Error('TabClientWebsocketAdapter: keepAlive subscribe requires callbacks (stream mode)');
    }
    return (await leaderCall('ws.subscribe', [args])) as IEvent[] | boolean;
  }

  async fetch(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    if (callbacks && Object.keys(callbacks).length > 0) {
      args.options = { ...defaultWebsocketAdapterOptions, ...(args.options ?? {}), stream: true };
      return this.streamWs('ws.fetch', args, callbacks);
    }
    this.ensureHash(args);
    return (await leaderCall('ws.fetch', [args])) as IEvent[] | boolean;
  }

  unsubscribe(hash?: string): void {
    if (!hash) return;
    this.keepAliveSubs.delete(hash);
    this.stopLeaderMonitoringIfIdle();
    getLeaderTabRpcClient().closeStream(hash);
    void getLeaderTabRpcClient().call('ws.unsubscribe', [hash]).catch(() => {});
  }

  unsubscribeAll(): void {
    this.keepAliveSubs.clear();
    this.stopLeaderMonitoringIfIdle();
    void leaderCall('ws.unsubscribeAll', []).catch(() => {});
  }

  async abort(): Promise<boolean> {
    this.keepAliveSubs.clear();
    this.stopLeaderMonitoringIfIdle();
    return (await leaderCall('ws.abort', [])) as boolean;
  }

  private cleanup() {
    try {
      StateManager.off('destroy', this.destroyListener);
    } catch {}

    for (const hash of this.keepAliveSubs.keys()) {
      try {
        getLeaderTabRpcClient().closeStream(hash);
      } catch {}
      try {
        void getLeaderTabRpcClient().call('ws.unsubscribe', [hash]).catch(() => {});
      } catch {}
    }

    this.keepAliveSubs.clear();
    this.stopLeaderListener?.();
    this.stopLeaderListener = null;
    this.stopLeaderMonitor?.();
    this.stopLeaderMonitor = null;
  }
}
