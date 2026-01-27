import { Event } from 'nostr-tools';
import PQueue from 'p-queue';
import { LogLevel } from './utils/Logger';

/**
 * Options for configuring the trawler
 * 
 * The trawler now supports an EventEmitter interface for handling events:
 * - 'event': Emitted when a new valid event is received
 * - 'progress': Emitted with progress updates
 * - 'error': Emitted when an error occurs
 * 
 * You can use either the event listener pattern:
 * ```
 * trawler.on('event', (event) => {...})
 * ```
 * 
 * Or the parser/validator pattern (legacy):
 * ```
 * parser: (trawler, event) => {...}
 * ```
 */
export interface TrawlerOptions {
  queueName?: string;
  repeatWhenComplete?: boolean;
  relaysPerBatch?: number;
  restDuration?: number;
  progressEvery?: number;
  filters?: Record<string, any>;
  since?: number | Record<string, number>;
  sinceStrict?: boolean;
  adapter?: 'pqueue' | 'bullmq';
  nostrFetcherOptions?: {
    sort?: boolean;
    [key: string]: any;
  };
  adapterOptions?: Record<string, any>;
  workerOptions?: Record<string, any>;
  queueOptions?: Record<string, any>;
  cache?: {
    enabled: boolean;
    path: string;
  };
  
  /**
   * Log level for the trawler
   * @default LogLevel.INFO
   */
  logLevel?: LogLevel;

  /**
   * Parser function for processing events (legacy approach)
   * Consider using event listeners instead: trawler.on('event', (event) => {...})
   */
  parser?: (trawler: any, event: Event, job: any) => Promise<void>;
  
  /**
   * Validator function for filtering events
   * @returns true to accept the event, false to reject it
   */
  validator?: (trawler: any, event: Event) => boolean;
  
  /**
   * Called after the cache is opened
   */
  after_cacheOpen?: (cache: any) => void;
}

export interface Progress {
  found: number;
  rejected: number;
  last_timestamp: number;
  highest_timestamp: number;
  lowest_timestamp: number;
  total: number;
  relay: string;
}

export interface QueueAdapter {
  init(): Promise<void>;
  run(): Promise<void>;
  pause(key?: string): void;
  clear(key?: string): void;
  start(key?: string): void;
  stop(key?: string): void;
  /**
   * Standard EventEmitter on method to register event listeners
   */
  on(event: string, listener: (...args: any[]) => void): this;
  
  /**
   * Standard EventEmitter emit method to emit events
   */
  emit(event: string, ...args: any[]): boolean;
  
  /**
   * @deprecated Use the standard EventEmitter on method with 'queue_' prefix
   */
  on_queue(key: string, data: any): this;
  
  /**
   * @deprecated Use the standard EventEmitter on method with 'worker_' prefix
   */
  on_worker(key: string, data: any): this;
}

export interface PQueueAdapterOptions extends TrawlerOptions {
  /**
   * Number of concurrent jobs to process
   * @default 1
   */
  concurrency?: number;
  
  /**
   * Timeout for each job in milliseconds
   * Set to undefined for no timeout (for long-running jobs)
   * @default undefined - no timeout
   */
  timeout?: number;
  
  /**
   * Whether to throw an error when a job times out
   * @default true
   */
  throwOnTimeout?: boolean;
  
  /**
   * Maximum number of jobs per interval
   * Must be a number >= 1
   */
  intervalCap?: number;
  
  /**
   * Interval in milliseconds
   * @default 0
   */
  interval?: number;
  
  /**
   * Whether to carry over concurrency count
   * @default false
   */
  carryoverConcurrencyCount?: boolean;
  
  /**
   * Whether to auto-start the queue
   * @default true
   */
  autoStart?: boolean;
  
  /**
   * Custom PQueue class to use
   */
  queueClass?: typeof PQueue;
} 