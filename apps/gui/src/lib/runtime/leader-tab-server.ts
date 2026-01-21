import type Route66 from '@nostrwatch/route66';
import { StateManager } from '@nostrwatch/route66';
import {
  defaultWebsocketAdapterOptions,
  defaultWebsocketRequestBody,
  type SubscribeHandlers,
  type WebsocketRequestBody,
} from '@nostrwatch/route66/core';

import {
  createId,
  isBrowser,
  LEADER_TAB_RPC_CHANNEL,
  LEADER_TAB_PROTOCOL_VERSION,
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
  private readonly termId = createId();
  private channel: BroadcastChannel | null = null;

  private keepAliveSubs = new Map<
    string,
    { clients: Set<string>; owned: boolean; listener?: (msg: any) => void }
  >();

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
      v: LEADER_TAB_PROTOCOL_VERSION,
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
      v: LEADER_TAB_PROTOCOL_VERSION,
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
      v: LEADER_TAB_PROTOCOL_VERSION,
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
    if ('v' in message && message.v !== LEADER_TAB_PROTOCOL_VERSION) return;
    if (message.type !== 'rpc') return;

    const req = message as RpcRequestMessage;
    if (!req?.op || !req?.requestId || !req?.sourceId) return;

    // Only the elected leader tab should answer.
    if (!this.options.isLeader()) return;

    // Prevent replying to our own server messages (shouldn't happen, but safe).
    if (req.sourceId === this.id) return;

    // Fast-path: leader liveness/term handshake does not require Route66.
    if (req.op === 'sys.hello') {
      this.replyOk(req.sourceId, req.requestId, {
        termId: this.termId,
        serverId: this.id,
        now: Date.now(),
      });
      return;
    }

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

        request.options = {
          ...defaultWebsocketAdapterOptions,
          ...(request.options ?? {}),
          stream: true,
          // Required for events to reach the adapter (and thus be streamable to follower tabs).
          returnResults: true,
        };

        const keepAlive = Boolean(request?.options?.keepAlive);

        // For keepAlive subscriptions: multiplex per-hash so multiple tabs can share one worker sub.
        if (method === 'subscribe' && keepAlive) {
          const hash = request.hash;
          if (!hash) throw new Error('ws.subscribe keepAlive requires request.hash');

          let entry = this.keepAliveSubs.get(hash);
          if (!entry) {
            entry = { clients: new Set(), owned: false };
            this.keepAliveSubs.set(hash, entry);

            // If something in the leader tab already started this hash, we can't add a second
            // callback via `ws.subscribe()` (WebsocketAdapter short-circuits on duplicate hashes).
            // Instead, listen directly on StateManager and fan-out to clients.
            const alreadySubscribed = Boolean(ws?.subscriptions?.has?.(hash));
            if (alreadySubscribed) {
              const listener = (msg: any) => {
                if (!msg || typeof msg !== 'object') return;
                if (msg?.hash !== hash) return;
                if (msg.type === 'event') {
                  for (const clientId of entry!.clients) this.stream(clientId, hash, 'event', msg.result);
                } else if (msg.type === 'events') {
                  for (const clientId of entry!.clients) this.stream(clientId, hash, 'events', msg.result);
                }
              };
              entry.listener = listener;
              StateManager.on(hash, listener);
            } else {
              entry.owned = true;
              const callbacks: SubscribeHandlers = {
                oneevent: (event: any) => {
                  for (const clientId of entry!.clients) {
                    this.stream(clientId, hash, 'event', event);
                  }
                },
                oneevents: (events: any[]) => {
                  for (const clientId of entry!.clients) {
                    this.stream(clientId, hash, 'events', events);
                  }
                },
              };

              // Start once; do not await (keepAlive never completes).
              void ws.subscribe(request, callbacks);
            }
          }

          entry.clients.add(req.sourceId);
          return true;
        }

        const callbacks: SubscribeHandlers = {
          oneevent: (event: any) => emitStream('event', event),
          oneevents: (events: any[]) => emitStream('events', events),
        };

        return await ws[method](request, callbacks);
      }

      if (method === 'unsubscribe') {
        const hash = args[0] as string | undefined;
        if (!hash) return true;

        const entry = this.keepAliveSubs.get(hash);
        if (entry) {
          entry.clients.delete(req.sourceId);
          if (entry.clients.size === 0) {
            this.keepAliveSubs.delete(hash);

            // If we started the underlying subscription, best-effort cleanup.
            if (entry.owned) {
              try {
                ws.request({
                  action: 'unsubscribe',
                  args: {
                    ...defaultWebsocketRequestBody,
                    hash,
                    options: { ...defaultWebsocketAdapterOptions, cache: false, returnResults: false, stream: false },
                  },
                });
              } catch {}
              try {
                ws.subscriptions?.delete?.(hash);
              } catch {}
              try {
                StateManager.off(hash);
              } catch {}
            } else if (entry.listener) {
              try {
                StateManager.off(hash, entry.listener);
              } catch {}
            }
          }
          return true;
        }

        // Not a multiplexed keepAlive subscription; best-effort fire-and-forget.
        // Do not mutate global subscription state here (it could be owned by the leader UI).
        try {
          ws.request({
            action: 'unsubscribe',
            args: {
              ...defaultWebsocketRequestBody,
              hash,
              options: { ...defaultWebsocketAdapterOptions, cache: false, returnResults: false, stream: false },
            },
          });
        } catch {}
        return true;
      }

      if (method === 'unsubscribeAll' || method === 'abort') {
        // Never abort the leader's websocket worker globally from a follower tab.
        // Instead, treat this as "detach this client from all keepAlive subs".
        for (const [hash, entry] of this.keepAliveSubs) {
          entry.clients.delete(req.sourceId);
          if (entry.clients.size === 0) {
            this.keepAliveSubs.delete(hash);
            if (entry.owned) {
              try {
                ws.request({
                  action: 'unsubscribe',
                  args: {
                    ...defaultWebsocketRequestBody,
                    hash,
                    options: { ...defaultWebsocketAdapterOptions, cache: false, returnResults: false, stream: false },
                  },
                });
              } catch {}
              try {
                ws.subscriptions?.delete?.(hash);
              } catch {}
              try {
                StateManager.off(hash);
              } catch {}
            } else if (entry.listener) {
              try {
                StateManager.off(hash, entry.listener);
              } catch {}
            }
          }
        }
        return true;
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
