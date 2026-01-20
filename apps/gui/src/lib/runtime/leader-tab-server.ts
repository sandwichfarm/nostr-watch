import type Route66 from '@nostrwatch/route66';
import type { SubscribeHandlers, WebsocketRequestBody } from '@nostrwatch/route66/core';

import {
  createId,
  isBrowser,
  LEADER_TAB_RPC_CHANNEL,
  type LeaderTabRpcMessage,
  type RpcRequestMessage,
  type RpcResponseMessage,
  type RpcStreamMessage,
} from './leader-tab-protocol';

export type LeaderTabServerOptions = {
  isLeader: () => boolean;
  getRoute66: () => Promise<Route66>;
};

const CACHE_METHOD_ALLOWLIST = new Set([
  'REQ',
  'COUNT',
  'DELETE',
  'DUMP',
  'CLOSE',
  'WIPE',
  'addEvent',
  'addEvents',
  'putEvent',
  'upsertNip11',
  'batchUpsertNip11',
  'countNip11s',
  'countUniqueNip11s',
  'getNip11',
]);

const WS_METHOD_ALLOWLIST = new Set([
  'publish',
  'subscribe',
  'fetch',
  'unsubscribe',
  'unsubscribeAll',
  'abort',
]);

export class LeaderTabRpcServer {
  private readonly id = createId();
  private channel: BroadcastChannel | null = null;

  constructor(private readonly options: LeaderTabServerOptions) {
    if (!isBrowser()) return;
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel(LEADER_TAB_RPC_CHANNEL);
    this.channel.addEventListener('message', (ev: MessageEvent) => {
      void this.onMessage(ev.data as LeaderTabRpcMessage);
    });
  }

  private post(message: RpcResponseMessage | RpcStreamMessage) {
    this.channel?.postMessage(message);
  }

  private replyOk(targetId: string, requestId: string, result: any) {
    const res: RpcResponseMessage = {
      type: 'rpc-res',
      requestId,
      sourceId: this.id,
      targetId,
      ok: true,
      result,
    };
    this.post(res);
  }

  private replyErr(targetId: string, requestId: string, error: unknown) {
    const res: RpcResponseMessage = {
      type: 'rpc-res',
      requestId,
      sourceId: this.id,
      targetId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    this.post(res);
  }

  private stream(targetId: string, requestId: string, kind: string, data?: any) {
    const msg: RpcStreamMessage = {
      type: 'rpc-stream',
      requestId,
      sourceId: this.id,
      targetId,
      kind,
      data,
    };
    this.post(msg);
  }

  private async onMessage(message: LeaderTabRpcMessage) {
    if (!message || typeof message !== 'object') return;
    if (message.type !== 'rpc') return;

    const req = message as RpcRequestMessage;
    if (!req?.op || !req?.requestId || !req?.sourceId) return;

    // Only the elected leader tab should answer.
    if (!this.options.isLeader()) return;

    // Prevent replying to our own server messages (shouldn't happen, but safe).
    if (req.sourceId === this.id) return;

    try {
      const r66 = await this.options.getRoute66();
      await r66.ready();

      const result = await this.dispatch(r66, req, (kind, data) => {
        if (req.stream) this.stream(req.sourceId, req.requestId, kind, data);
      });

      this.replyOk(req.sourceId, req.requestId, result);
    } catch (e) {
      this.replyErr(req.sourceId, req.requestId, e);
    }
  }

  private async dispatch(
    r66: Route66,
    req: RpcRequestMessage,
    emitStream: (kind: string, data?: any) => void
  ) {
    const [namespace, methodRaw] = req.op.split('.', 2);
    const args = Array.isArray(req.args) ? req.args : [];

    if (namespace === 'cache') {
      const cache: any = r66.adapters?.cacheAdapter;
      const method = methodRaw;
      if (!CACHE_METHOD_ALLOWLIST.has(method)) {
        throw new Error(`cache method not allowed: ${method}`);
      }
      if (!cache || typeof cache[method] !== 'function') {
        throw new Error(`cache method missing: ${method}`);
      }
      return await cache[method](...args);
    }

    if (namespace === 'ws') {
      const ws: any = r66.adapters?.websocketAdapter;
      const method = methodRaw;
      if (!WS_METHOD_ALLOWLIST.has(method)) {
        throw new Error(`ws method not allowed: ${method}`);
      }
      if (!ws || typeof ws[method] !== 'function') {
        throw new Error(`ws method missing: ${method}`);
      }

      if ((method === 'fetch' || method === 'subscribe') && req.stream) {
        const request = args[0] as WebsocketRequestBody | undefined;
        if (!request) throw new Error('ws request missing');

        const callbacks: SubscribeHandlers = {
          oneevent: (event: any) => emitStream('event', event),
          oneevents: (events: any[]) => emitStream('events', events),
          onclose: (subId: string) => emitStream('close', subId),
          oneose: () => emitStream('eose'),
        };

        const keepAlive = Boolean(request?.options?.keepAlive);

        // For keepAlive subscriptions, return immediately so followers don't hang forever.
        if (keepAlive) {
          void ws[method](request, callbacks);
          return true;
        }

        return await ws[method](request, callbacks);
      }

      return await ws[method](...args);
    }

    throw new Error(`unknown rpc namespace: ${namespace}`);
  }

  destroy() {
    if (!this.channel) return;
    this.channel.close();
    this.channel = null;
  }
}

let singleton: LeaderTabRpcServer | null = null;

export function startLeaderTabRpcServer(options: LeaderTabServerOptions): LeaderTabRpcServer {
  if (!singleton) singleton = new LeaderTabRpcServer(options);
  return singleton;
}

export function stopLeaderTabRpcServer() {
  singleton?.destroy();
  singleton = null;
}

