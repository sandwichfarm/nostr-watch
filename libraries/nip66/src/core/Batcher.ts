type BatchCallback<T, S> = (batch: T[], state: S | undefined, id: string | undefined) => void;

export interface BatchOptions<T, S> {
  maxLength: number;
  timeout: number;
  callback: BatchCallback<T, S>;
}

export class Batcher<T, S> {
  private batches: Map<string | undefined, { items: T[]; state?: S; lastBatchTime: number }> = new Map();
  private timeoutIds: Map<string | undefined, ReturnType<typeof setTimeout>> = new Map();

  constructor(private readonly options: BatchOptions<T, S>) {}

  add(item: T, id?: string, state?: S): void {
    if (!this.batches.has(id)) {
      this.batches.set(id, { items: [], state, lastBatchTime: Date.now() });
    }

    const batch = this.batches.get(id)!;

    if (state !== undefined) {
      batch.state = state;
    }

    batch.items.push(item);

    if (batch.items.length >= this.options.maxLength) {
      this.executeBatch(id);
    }

    if (!this.timeoutIds.has(id)) {
      this.startTimeout(id);
    }
  }

  private executeBatch(id?: string): void {
    const batch = this.batches.get(id);
    if (!batch || batch.items.length === 0) return;

    this.options.callback(batch.items, batch.state, id);

    batch.items = [];
    batch.lastBatchTime = Date.now();

    if (this.timeoutIds.has(id)) {
      clearTimeout(this.timeoutIds.get(id)!);
      this.timeoutIds.delete(id);
    }
  }

  private startTimeout(id?: string): void {
    const batch = this.batches.get(id);
    if (!batch) return;

    const timeoutId = setTimeout(() => {
      const now = Date.now();
      if (now - batch.lastBatchTime >= this.options.timeout) {
        this.executeBatch(id);
      }
    }, this.options.timeout);

    this.timeoutIds.set(id, timeoutId);
  }

  hasState(id?: string): boolean {
    const batch = this.batches.get(id);
    return batch?.state !== undefined;
  }

  abort(): void {
    for (const timeoutId of Array.from(this.timeoutIds.values())) {
      clearTimeout(timeoutId);
    }
    this.batches.clear();
    this.timeoutIds.clear();
  }
}
