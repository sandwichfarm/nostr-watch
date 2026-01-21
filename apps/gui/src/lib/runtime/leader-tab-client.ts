import {
  createId,
  isBrowser,
  LEADER_TAB_RPC_CHANNEL,
  LEADER_TAB_PROTOCOL_VERSION,
  type LeaderTabRpcMessage,
  type BroadcastMessage,
  type RpcRequestMessage,
  type RpcResponseMessage,
  type RpcStreamMessage,
} from './leader-tab-protocol';

type PendingCall = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId?: number;
};

type StreamHandler = (msg: RpcStreamMessage) => void;

export type CallOptions = {
  requestId?: string;
  timeoutMs?: number;
};

export type WaitForLeaderOptions = {
  timeoutMs?: number;
  pollMs?: number;
};

export type CallStreamOptions = CallOptions & {
  onStream: StreamHandler;
  autoCloseOnResponse?: boolean;
};

export class LeaderTabRpcClient {
  public readonly id: string;

  private channel: BroadcastChannel | null = null;
  private pending = new Map<string, PendingCall>();
  private streams = new Map<string, StreamHandler>();
  private broadcasts = new Set<(msg: BroadcastMessage) => void>();

  constructor() {
    this.id = createId();
    if (!isBrowser()) return;
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel(LEADER_TAB_RPC_CHANNEL);
    this.channel.addEventListener('message', (ev: MessageEvent) => {
      this.onMessage(ev.data as LeaderTabRpcMessage);
    });
  }

  private onMessage(message: LeaderTabRpcMessage) {
    if (!message || typeof message !== 'object') return;
    if ('v' in message && message.v !== LEADER_TAB_PROTOCOL_VERSION) return;

    // Ignore messages sent by this same client instance
    if ('sourceId' in message && message.sourceId === this.id) return;

    if (message.type === 'broadcast') {
      const b = message as BroadcastMessage;
      this.broadcasts.forEach((fn) => fn(b));
      return;
    }

    if (message.type === 'rpc-res') {
      const res = message as RpcResponseMessage;
      if (res.targetId !== this.id) return;
      const pending = this.pending.get(res.requestId);
      if (!pending) return;
      this.pending.delete(res.requestId);
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      if (res.ok) pending.resolve(res.result);
      else pending.reject(new Error(res.error || 'Leader RPC failed'));
      return;
    }

    if (message.type === 'rpc-stream') {
      const stream = message as RpcStreamMessage;
      if (stream.targetId !== this.id) return;
      const handler = this.streams.get(stream.requestId);
      if (!handler) return;
      handler(stream);
      return;
    }
  }

  private post(message: LeaderTabRpcMessage) {
    if (!this.channel) throw new Error('LeaderTabRpcClient: BroadcastChannel unavailable');
    this.channel.postMessage(message);
  }

  call(op: string, args: any[] = [], options: CallOptions = {}): Promise<any> {
    const requestId = options.requestId ?? createId();
    const timeoutMs = options.timeoutMs ?? 30_000;

    if (this.pending.has(requestId)) {
      return Promise.reject(new Error(`Leader RPC request already pending: ${requestId}`));
    }

    return new Promise((resolve, reject) => {
      const timeoutId =
        timeoutMs > 0
          ? window.setTimeout(() => {
              this.pending.delete(requestId);
              reject(new Error(`Leader RPC timeout: ${op}`));
            }, timeoutMs)
          : undefined;

      this.pending.set(requestId, { resolve, reject, timeoutId });

      const req: RpcRequestMessage = {
        v: LEADER_TAB_PROTOCOL_VERSION,
        type: 'rpc',
        requestId,
        sourceId: this.id,
        op,
        args,
      };
      this.post(req);
    });
  }

  async waitForLeader(options: WaitForLeaderOptions = {}) {
    const timeoutMs = options.timeoutMs ?? 5_000;
    const pollMs = options.pollMs ?? 100;
    const start = Date.now();

    let lastError: unknown = undefined;
    while (Date.now() - start < timeoutMs) {
      try {
        // `sys.hello` is handled as a fast-path by the leader (no Route66 required).
        return await this.call('sys.hello', [], { timeoutMs: Math.min(750, timeoutMs) });
      } catch (e) {
        lastError = e;
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    }

    throw lastError ?? new Error('No leader available');
  }

  callStream(op: string, args: any[] = [], options: CallStreamOptions): Promise<any> {
    const requestId = options.requestId ?? createId();
    const timeoutMs = options.timeoutMs ?? 30_000;
    const autoCloseOnResponse = options.autoCloseOnResponse ?? true;

    if (this.pending.has(requestId)) {
      return Promise.reject(new Error(`Leader RPC request already pending: ${requestId}`));
    }

    this.streams.set(requestId, options.onStream);

    return new Promise((resolve, reject) => {
      const timeoutId =
        timeoutMs > 0
          ? window.setTimeout(() => {
              this.pending.delete(requestId);
              // If a stream never establishes, keeping it around just leaks.
              // Established keepAlive streams should resolve quickly (leader returns immediately).
              this.streams.delete(requestId);
              reject(new Error(`Leader RPC timeout: ${op}`));
            }, timeoutMs)
          : undefined;

      this.pending.set(requestId, {
        resolve: (value) => {
          if (autoCloseOnResponse) this.streams.delete(requestId);
          resolve(value);
        },
        reject: (err) => {
          this.streams.delete(requestId);
          reject(err);
        },
        timeoutId,
      });

      const req: RpcRequestMessage = {
        v: LEADER_TAB_PROTOCOL_VERSION,
        type: 'rpc',
        requestId,
        sourceId: this.id,
        op,
        args,
        stream: true,
      };
      this.post(req);
    });
  }

  closeStream(requestId: string) {
    this.streams.delete(requestId);
  }

  onBroadcast(handler: (msg: BroadcastMessage) => void): () => void {
    this.broadcasts.add(handler);
    return () => this.broadcasts.delete(handler);
  }

  broadcast(kind: string, data?: any) {
    const msg: BroadcastMessage = {
      v: LEADER_TAB_PROTOCOL_VERSION,
      type: 'broadcast',
      sourceId: this.id,
      kind,
      data,
    };
    this.post(msg);
  }

  destroy() {
    if (!this.channel) return;
    this.channel.close();
    this.channel = null;
    this.pending.clear();
    this.streams.clear();
    this.broadcasts.clear();
  }
}

let singleton: LeaderTabRpcClient | null = null;

export function getLeaderTabRpcClient(): LeaderTabRpcClient {
  if (!singleton) singleton = new LeaderTabRpcClient();
  return singleton;
}
