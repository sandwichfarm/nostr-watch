import type { IEvent } from '@nostrwatch/route66/models';

type VerifyResult = { id: string; valid: boolean };

type VerifyRequest = {
  type: 'verify';
  requestId: string;
  events: any[];
};

type VerifyResponse = {
  type: 'verify-result';
  requestId: string;
  results: VerifyResult[];
};

type Pending = {
  resolve: (value: VerifyResult[]) => void;
  reject: (reason?: any) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

function createId(): string {
  const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
  if (cryptoAny?.randomUUID) return cryptoAny.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultPoolSize(): number {
  const hc = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0;
  const desired = (hc || 4) - 2;
  return Math.max(1, Math.min(6, desired));
}

class VerifyWorkerClient {
  private worker: Worker;
  private pending = new Map<string, Pending>();

  constructor() {
    this.worker = new Worker(new URL('./signature-verification.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (ev: MessageEvent) => this.onMessage(ev as MessageEvent<VerifyResponse>);
    this.worker.onerror = () => {
      for (const [requestId, pending] of this.pending.entries()) {
        clearTimeout(pending.timeoutId);
        pending.reject(new Error('Signature verification worker error'));
        this.pending.delete(requestId);
      }
    };
  }

  private onMessage(ev: MessageEvent<VerifyResponse>) {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type !== 'verify-result') return;
    const pending = this.pending.get(msg.requestId);
    if (!pending) return;
    this.pending.delete(msg.requestId);
    clearTimeout(pending.timeoutId);
    pending.resolve(Array.isArray(msg.results) ? msg.results : []);
  }

  verify(events: any[], timeoutMs: number): Promise<VerifyResult[]> {
    const requestId = createId();
    const req: VerifyRequest = { type: 'verify', requestId, events };
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Signature verification timeout'));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeoutId });
      this.worker.postMessage(req);
    });
  }

  terminate() {
    for (const pending of this.pending.values()) clearTimeout(pending.timeoutId);
    this.pending.clear();
    this.worker.terminate();
  }
}

export class SignatureVerificationService {
  private readonly workers: VerifyWorkerClient[];
  private idx = 0;

  private verified = new Set<string>();
  private invalid = new Set<string>();

  constructor(
    options: {
      poolSize?: number;
      timeoutMs?: number;
    } = {}
  ) {
    const poolSize = options.poolSize ?? defaultPoolSize();
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.workers = Array.from({ length: poolSize }, () => new VerifyWorkerClient());
  }

  private readonly timeoutMs: number;

  get verifiedCount(): number {
    return this.verified.size;
  }

  get invalidCount(): number {
    return this.invalid.size;
  }

  hasVerified(id: string): boolean {
    return this.verified.has(id);
  }

  isValid(id: string): boolean | undefined {
    if (!this.verified.has(id)) return undefined;
    return !this.invalid.has(id);
  }

  async verifyEvents(events: IEvent[], opts: { kinds?: number[] } = {}): Promise<void> {
    if (!events?.length) return;

    const kindAllowlist = Array.isArray(opts.kinds) && opts.kinds.length ? new Set(opts.kinds) : null;

    const toVerify: any[] = [];
    for (const event of events as any[]) {
      const id = event?.id;
      if (typeof id !== 'string') continue;
      if (this.verified.has(id)) continue;
      if (kindAllowlist && !kindAllowlist.has(event?.kind)) continue;
      if (!event?.sig && !event?.signature) continue;
      toVerify.push(event);
    }

    if (!toVerify.length) return;

    const worker = this.workers[this.idx % this.workers.length];
    this.idx++;

    const results = await worker.verify(toVerify, this.timeoutMs);
    for (const r of results) {
      this.verified.add(r.id);
      if (!r.valid) this.invalid.add(r.id);
    }
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
  }
}

let singleton: SignatureVerificationService | null = null;

export function getSignatureVerificationService(
  options: { create?: boolean } = {}
): SignatureVerificationService | null {
  const canUse =
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof URL !== 'undefined';
  if (!canUse) return null;

  const create = options.create ?? true;
  if (!singleton) {
    if (!create) return null;
    singleton = new SignatureVerificationService();
  }
  return singleton;
}

export function stopSignatureVerificationService(): void {
  singleton?.terminate();
  singleton = null;
}
