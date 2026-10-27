import type { UniversalWebSocket } from '@nostrwatch/websocket';

export class MessageTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`No matching message within ${timeoutMs}ms`);
    this.name = 'MessageTimeoutError';
  }
}

export class MessageConnectionError extends Error {
  constructor(readonly reason: 'closed' | 'error' | 'failed', message: string) {
    super(message);
    this.name = 'MessageConnectionError';
  }
}

type Message = any[];
type Predicate = (message: Message) => boolean;
type Waiter = {
  predicate: Predicate;
  after: number;
  resolve(message: Message): void;
  reject(error: Error): void;
};

/** An owned connection with ordered JSON messages and bounded, correlated waits. */
export class MessageSession {
  readonly messages: Message[] = [];
  private readonly waiters = new Set<Waiter>();
  private failure?: Error;
  private disposed = false;

  private readonly onMessage = ({ data }: MessageEvent) => {
    if (this.failure) return;
    let message: Message;
    try {
      message = JSON.parse(String(data));
      if (!Array.isArray(message)) throw new Error('Expected a JSON array');
    } catch (error) {
      this.fail(new Error(`Invalid JSON message: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    const index = this.messages.push(message) - 1;
    for (const waiter of [...this.waiters]) {
      if (index < waiter.after) continue;
      try {
        if (waiter.predicate(message)) waiter.resolve(message);
      } catch (error) {
        waiter.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };
  private readonly onClose = (event: CloseEvent) => this.fail(new MessageConnectionError(
    'closed', `Connection closed during conversation (${event.code ?? 'unknown'}: ${event.reason ?? ''})`));
  private readonly onError = (event: Event) => this.fail(new MessageConnectionError(
    'error', `Connection error during conversation: ${(event as any).message ?? (event as any).error?.message ?? 'unknown transport error'}`));

  constructor(readonly socket: UniversalWebSocket, private readonly timeoutMs = 5000) {
    socket.on('message', this.onMessage);
    socket.on('close', this.onClose);
    socket.on('error', this.onError);
  }

  async connect(): Promise<void> {
    this.assertActive();
    const connected = await this.socket.connect();
    if (this.disposed) this.socket.terminate();
    this.assertActive();
    if (!connected || !this.socket.CONNECTED) {
      this.fail(new MessageConnectionError('failed', 'Could not establish conversation connection'));
      this.assertActive();
    }
  }

  send(message: unknown[]): void {
    this.assertActive();
    this.socket.send(JSON.stringify(message));
  }

  waitFor(predicate: Predicate, options: { after?: number; timeoutMs?: number } = {}): Promise<Message> {
    const after = options.after ?? 0;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    return new Promise<Message>((resolve, reject) => {
      this.assertActive();
      for (const message of this.messages.slice(after)) {
        if (predicate(message)) {
          resolve(message);
          return;
        }
      }
      const timer = setTimeout(() => waiter.reject(new MessageTimeoutError(timeoutMs)), timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.waiters.delete(waiter);
      };
      const waiter: Waiter = {
        predicate,
        after,
        resolve: (message) => { cleanup(); resolve(message); },
        reject: (error) => { cleanup(); reject(error); },
      };
      this.waiters.add(waiter);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fail(new Error('Conversation disposed'));
    this.socket.off('message', this.onMessage);
    this.socket.off('close', this.onClose);
    this.socket.off('error', this.onError);
    this.socket.terminate();
  }

  private assertActive(): void {
    if (this.failure) throw this.failure;
  }

  private fail(error: Error): void {
    if (this.failure) return;
    this.failure = error;
    for (const waiter of [...this.waiters]) waiter.reject(error);
  }
}
