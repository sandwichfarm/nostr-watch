import {
  createId,
  isBrowser,
  LEADER_TAB_RPC_CHANNEL,
  LEADER_TAB_PROTOCOL_VERSION,
  type LeaderTabRpcMessage,
  type BroadcastMessage,
  type LeaderTabHello,
  type LeaderTabRpcOp,
  type LeaderTabRpcOpMap,
  type RpcRequestMessage,
  type RpcResponseMessage,
  type RpcStreamMessage,
} from './leader-tab-protocol';

type PendingCall = {
  promise: Promise<any>;
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

export type LeaderInfo = LeaderTabHello;

type LeaderMonitorOptions = {
  pollMs?: number;
  timeoutMs?: number;
};

export class LeaderTabRpcClient {
  public readonly id: string;

  private channel: BroadcastChannel | null = null;
  private pending = new Map<string, PendingCall>();
  private streams = new Map<string, Set<StreamHandler>>();
  private streamSources = new Map<string, string>();
  private broadcasts = new Set<(msg: BroadcastMessage) => void>();

  private leaderInfo: LeaderInfo | null = null;
  private leaderListeners = new Set<(info: LeaderInfo | null) => void>();

  private monitorRefCount = 0;
  private monitorIntervalId: number | null = null;
  private monitorInFlight = false;

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
      // For streaming calls, lock streams to the responding leader instance.
      if (this.streams.has(res.requestId)) {
        this.streamSources.set(res.requestId, res.sourceId);
      }
      if (res.ok) pending.resolve(res.result);
      else pending.reject(new Error(res.error || 'Leader RPC failed'));
      return;
    }

    if (message.type === 'rpc-stream') {
      const stream = message as RpcStreamMessage;
      if (stream.targetId !== this.id) return;
      const expectedSource = this.streamSources.get(stream.requestId);
      if (expectedSource && stream.sourceId !== expectedSource) return;
      const handlers = this.streams.get(stream.requestId);
      if (!handlers || handlers.size === 0) return;
      for (const handler of handlers) {
        try {
          handler(stream);
        } catch {
          // Avoid letting a single subscriber crash all stream processing.
        }
      }
      return;
    }
  }

  private post(message: LeaderTabRpcMessage) {
    if (!this.channel) throw new Error('LeaderTabRpcClient: BroadcastChannel unavailable');
    this.channel.postMessage(message);
  }

  call<K extends LeaderTabRpcOp>(
    op: K,
    args: LeaderTabRpcOpMap[K]['args'],
    options: CallOptions = {}
  ): Promise<LeaderTabRpcOpMap[K]['result']> {
    const requestId = options.requestId ?? createId();
    const timeoutMs = options.timeoutMs ?? 30_000;

    const existing = this.pending.get(requestId);
    if (existing) {
      return existing.promise as Promise<LeaderTabRpcOpMap[K]['result']>;
    }

    let timeoutId: number | undefined = undefined;
    let resolveFn!: (value: any) => void;
    let rejectFn!: (reason?: any) => void;

    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    if (timeoutMs > 0) {
      timeoutId = window.setTimeout(() => {
        this.pending.delete(requestId);
        rejectFn(new Error(`Leader RPC timeout: ${op}`));
      }, timeoutMs);
    }

    this.pending.set(requestId, { promise, resolve: resolveFn, reject: rejectFn, timeoutId });

    const req: RpcRequestMessage = {
      v: LEADER_TAB_PROTOCOL_VERSION,
      type: 'rpc',
      requestId,
      sourceId: this.id,
      op,
      args: args as unknown as any[],
    };
    this.post(req);

    return promise as Promise<LeaderTabRpcOpMap[K]['result']>;
  }

  async waitForLeader(options: WaitForLeaderOptions = {}) {
    const timeoutMs = options.timeoutMs ?? 5_000;
    const pollMs = options.pollMs ?? 100;
    const start = Date.now();

    let lastError: unknown = undefined;
    while (Date.now() - start < timeoutMs) {
      try {
        // `sys.hello` is handled as a fast-path by the leader (no Route66 required).
        const hello = (await this.call('sys.hello', [], {
          timeoutMs: Math.min(750, timeoutMs),
        })) as LeaderInfo;
        this.updateLeaderInfo(hello);
        return hello;
      } catch (e) {
        lastError = e;
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    }

    throw lastError ?? new Error('No leader available');
  }

  private updateLeaderInfo(next: LeaderInfo | null) {
    const prev = this.leaderInfo;
    const changed =
      (prev?.termId ?? null) !== (next?.termId ?? null) ||
      (prev?.serverId ?? null) !== (next?.serverId ?? null);

    this.leaderInfo = next;
    if (changed) {
      this.leaderListeners.forEach((fn) => fn(next));
    }
  }

  getLeaderInfo(): LeaderInfo | null {
    return this.leaderInfo;
  }

  onLeaderChange(handler: (info: LeaderInfo | null) => void): () => void {
    this.leaderListeners.add(handler);
    return () => this.leaderListeners.delete(handler);
  }

  startLeaderMonitor(options: LeaderMonitorOptions = {}): () => void {
    if (!isBrowser()) return () => {};
    const pollMs = options.pollMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 750;

    this.monitorRefCount++;
    if (this.monitorIntervalId === null) {
      const tick = async () => {
        if (this.monitorInFlight) return;
        this.monitorInFlight = true;
        try {
          const hello = (await this.call('sys.hello', [], { timeoutMs })) as LeaderInfo;
          this.updateLeaderInfo(hello);
        } catch {
          this.updateLeaderInfo(null);
        } finally {
          this.monitorInFlight = false;
        }
      };

      void tick();
      this.monitorIntervalId = window.setInterval(() => void tick(), pollMs);
    }

    return () => {
      this.monitorRefCount = Math.max(0, this.monitorRefCount - 1);
      if (this.monitorRefCount === 0 && this.monitorIntervalId !== null) {
        clearInterval(this.monitorIntervalId);
        this.monitorIntervalId = null;
        this.monitorInFlight = false;
      }
    };
  }

  callStream<K extends LeaderTabRpcOp>(
    op: K,
    args: LeaderTabRpcOpMap[K]['args'],
    options: CallStreamOptions
  ): Promise<LeaderTabRpcOpMap[K]['result']> {
    const requestId = options.requestId ?? createId();
    const timeoutMs = options.timeoutMs ?? 30_000;
    const autoCloseOnResponse = options.autoCloseOnResponse ?? true;

    // Deduplicate concurrent stream requests for the same `requestId`. This commonly happens when
    // multiple components race to subscribe to the same deterministic hash. We fan-out stream
    // events to all registered handlers and return the in-flight promise.
    const existing = this.pending.get(requestId);
    if (existing) {
      this.addStreamHandler(requestId, options.onStream);
      return existing.promise as Promise<LeaderTabRpcOpMap[K]['result']>;
    }

    // New stream request (not a join): replace any prior handlers for this requestId.
    this.streams.set(requestId, new Set([options.onStream]));

    let timeoutId: number | undefined = undefined;
    let resolveFn!: (value: any) => void;
    let rejectFn!: (reason?: any) => void;

    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    if (timeoutMs > 0) {
      timeoutId = window.setTimeout(() => {
        this.pending.delete(requestId);
        // If a stream never establishes, keeping it around just leaks.
        // Established keepAlive streams should resolve quickly (leader returns immediately).
        this.streams.delete(requestId);
        rejectFn(new Error(`Leader RPC timeout: ${op}`));
      }, timeoutMs);
    }

    this.pending.set(requestId, {
      promise,
      resolve: (value) => {
        if (autoCloseOnResponse) {
          this.streams.delete(requestId);
          this.streamSources.delete(requestId);
        }
        resolveFn(value);
      },
      reject: (err) => {
        this.streams.delete(requestId);
        this.streamSources.delete(requestId);
        rejectFn(err);
      },
      timeoutId,
    });

    const req: RpcRequestMessage = {
      v: LEADER_TAB_PROTOCOL_VERSION,
      type: 'rpc',
      requestId,
      sourceId: this.id,
      op,
      args: args as unknown as any[],
      stream: true,
    };
    this.post(req);

    return promise as Promise<LeaderTabRpcOpMap[K]['result']>;
  }

  closeStream(requestId: string) {
    this.streams.delete(requestId);
    this.streamSources.delete(requestId);
  }

  private addStreamHandler(requestId: string, handler: StreamHandler) {
    const existing = this.streams.get(requestId);
    if (existing) {
      existing.add(handler);
      return;
    }
    this.streams.set(requestId, new Set([handler]));
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
    this.streamSources.clear();
    this.broadcasts.clear();
    this.leaderListeners.clear();
    this.updateLeaderInfo(null);
    if (this.monitorIntervalId !== null) clearInterval(this.monitorIntervalId);
    this.monitorIntervalId = null;
    this.monitorRefCount = 0;
    this.monitorInFlight = false;
  }
}

let singleton: LeaderTabRpcClient | null = null;

export function getLeaderTabRpcClient(): LeaderTabRpcClient {
  if (!singleton) singleton = new LeaderTabRpcClient();
  return singleton;
}
