import NTTrawler from './Trawler';
import { TrawlerOptions, Progress } from '../types';

export default class NTQueue extends NTTrawler {
  protected $q: any;
  protected queue: any;
  protected worker: any;
  /**
   * @deprecated Use EventEmitter's event system instead
   */
  protected cb: Record<string, (...args: any[]) => void>;
  protected since: Record<string, number>;
  protected repeatTimeout: NodeJS.Timeout | null;

  constructor(relays: string[], options: TrawlerOptions) {
    super(relays, options);
    this.$q = null;
    this.queue = null;
    this.worker = null;
    this.cb = {};
    this.since = {};
    this.repeatTimeout = null;
  }

  /**
   * @deprecated Use emit() instead. This will be removed in a future version.
   */
  async _on(key: string, ...args: any[]): Promise<void> {
    // Call legacy callback if it exists
    if (this.cb?.[key]) {
      this.cb[key](...args);
    }
    
    // Call handle_* method if it exists
    const handlerName = `handle_${key}` as keyof this;
    if (handlerName in this && typeof (this[handlerName] as Function) === 'function') {
      await (this[handlerName] as Function)(...args);
    }
    
    // Forward to the standard EventEmitter system
    this.emit(key, ...args);
  }

  /**
   * @deprecated Use the standard EventEmitter on() method directly. This will be removed in a future version.
   */
  legacyOn(key: string, callback: (...args: any[]) => void): this {
    this.cb[key] = callback;
    this.on(key, callback);
    return this;
  }

  /**
   * @deprecated Use the standard EventEmitter on() method with prefixed events. This will be removed in a future version.
   */
  on_queue(key: string, data: any): this {
    const prefixedKey = `queue_${key}`;
    this.on(prefixedKey, data);
    return this;
  }

  /**
   * @deprecated Use the standard EventEmitter on() method with prefixed events. This will be removed in a future version.
   */
  on_worker(key: string, data: any): this {
    const prefixedKey = `worker_${key}`;
    this.on(prefixedKey, data);
    return this;
  }

  async handle_queue_drained($job: any, result: any): Promise<void> {
    const timeoutExists = this.repeatTimeout !== null;
    if (this.options?.repeatWhenComplete && !timeoutExists) {
      this.repeatTimeout = setTimeout(() => this.run(), this.options?.restDuration);
    }
  }

  addFirstJob(fn: Function, target: any): void {
    // Implementation depends on the specific queue implementation
  }

  pause(key?: string): void {
    this.$q?.pause(key);
  }

  clear(key?: string): void {
    this.$q?.clear(key);
  }

  start(key?: string): void {
    this.$q?.start(key);
  }

  stop(key?: string): void {
    this.$q?.stop(key);
  }

  public async updateProgress(progress: Progress, $job: any): Promise<void> {
    // Implementation depends on the specific queue implementation
  }
}
