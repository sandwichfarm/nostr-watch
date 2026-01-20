import type { IEvent } from '@nostrwatch/route66/models';

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
    return (await getLeaderTabRpcClient().call('cache.REQ', [filters])) as IEvent[];
  }

  async COUNT(filters: any[]): Promise<number> {
    return (await getLeaderTabRpcClient().call('cache.COUNT', [filters])) as number;
  }

  async DELETE(filters: any[]): Promise<string[]> {
    return (await getLeaderTabRpcClient().call('cache.DELETE', [filters])) as string[];
  }

  async DUMP(): Promise<Uint8Array> {
    return (await getLeaderTabRpcClient().call('cache.DUMP', [])) as Uint8Array;
  }

  async CLOSE(subId: string): Promise<boolean> {
    return (await getLeaderTabRpcClient().call('cache.CLOSE', [subId])) as boolean;
  }

  async WIPE(): Promise<boolean> {
    return (await getLeaderTabRpcClient().call('cache.WIPE', [])) as boolean;
  }

  async addEvent(event: IEvent): Promise<void> {
    await getLeaderTabRpcClient().call('cache.addEvent', [event]);
  }

  async addEvents(events: IEvent[]): Promise<void> {
    await getLeaderTabRpcClient().call('cache.addEvents', [events]);
  }

  async putEvent(event: IEvent): Promise<void> {
    await getLeaderTabRpcClient().call('cache.putEvent', [event]);
  }

  async upsertNip11(relay: string, nip11: any): Promise<void> {
    await getLeaderTabRpcClient().call('cache.upsertNip11', [relay, nip11]);
  }

  async batchUpsertNip11(relayNip11s: { relay: string; nip11: any }[]): Promise<boolean> {
    return (await getLeaderTabRpcClient().call('cache.batchUpsertNip11', [relayNip11s])) as boolean;
  }

  async countNip11s(): Promise<number> {
    return (await getLeaderTabRpcClient().call('cache.countNip11s', [])) as number;
  }

  async countUniqueNip11s(): Promise<number> {
    return (await getLeaderTabRpcClient().call('cache.countUniqueNip11s', [])) as number;
  }

  async getNip11(relay: any): Promise<any> {
    return await getLeaderTabRpcClient().call('cache.getNip11', [relay]);
  }
}

export class TabClientWebsocketAdapter extends WebsocketAdapter implements IWebsocketAdapter {
  readonly slug: string = 'tab-client-websocket';
  useWorker: boolean = false;
  handleSetupInternally: boolean = true;

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

    return (await getLeaderTabRpcClient().callStream(op, [args], {
      requestId: hash,
      autoCloseOnResponse: !keepAlive,
      onStream: onStream as any,
    })) as IEvent[] | boolean;
  }

  async publish(args: Partial<WebsocketRequestBody>): Promise<boolean> {
    return (await getLeaderTabRpcClient().call('ws.publish', [args])) as boolean;
  }

  async subscribe(
    args: WebsocketRequestBody,
    callbacks?: SubscribeHandlers
  ): Promise<IEvent[] | boolean> {
    if (callbacks && Object.keys(callbacks).length > 0) {
      args.options = { ...defaultWebsocketAdapterOptions, ...(args.options ?? {}), stream: true };
      return this.streamWs('ws.subscribe', args, callbacks);
    }
    this.ensureHash(args);
    return (await getLeaderTabRpcClient().call('ws.subscribe', [args])) as IEvent[] | boolean;
  }

  async fetch(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    if (callbacks && Object.keys(callbacks).length > 0) {
      args.options = { ...defaultWebsocketAdapterOptions, ...(args.options ?? {}), stream: true };
      return this.streamWs('ws.fetch', args, callbacks);
    }
    this.ensureHash(args);
    return (await getLeaderTabRpcClient().call('ws.fetch', [args])) as IEvent[] | boolean;
  }

  unsubscribe(hash?: string): void {
    if (!hash) return;
    getLeaderTabRpcClient().closeStream(hash);
    void getLeaderTabRpcClient().call('ws.unsubscribe', [hash]).catch(() => {});
  }

  unsubscribeAll(): void {
    void getLeaderTabRpcClient().call('ws.unsubscribeAll', []).catch(() => {});
  }

  async abort(): Promise<boolean> {
    return (await getLeaderTabRpcClient().call('ws.abort', [])) as boolean;
  }
}
