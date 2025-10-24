/**
 * Mock Implementations for RelayMon Testing
 *
 * Mock objects and stubs for external dependencies.
 */

import { mockConfig } from "./fixtures.ts";

/**
 * Mock QueueManager for testing Worker and other components
 */
export class MockQueueManager {
  private checkQueue: Array<{ fn: () => Promise<void>, relay: string }> = [];
  private publishQueue: Array<{ fn: () => Promise<any>, options: any }> = [];
  public enqueuedRelays: Set<string> = new Set();

  constructor(
    public concurrency: number = 5,
    public publishConcurrency: number = 1,
    public config: any = mockConfig
  ) {}

  addCheckJob(fn: () => Promise<void>, relay: string): void {
    this.checkQueue.push({ fn, relay });
    this.enqueuedRelays.add(relay);
  }

  addPublishJob(fn: () => Promise<any>, options: any = {}): void {
    this.publishQueue.push({ fn, options });
  }

  isRelayEnqueued(relay: string): boolean {
    return this.enqueuedRelays.has(relay);
  }

  async processCheckQueue(): Promise<void> {
    const jobs = [...this.checkQueue];
    this.checkQueue = [];

    for (const job of jobs) {
      try {
        await job.fn();
      } catch (error) {
        console.error(`Mock queue error for ${job.relay}:`, error);
      } finally {
        // Always remove from enqueued set, even on error
        this.enqueuedRelays.delete(job.relay);
      }
    }
  }

  async processPublishQueue(): Promise<void> {
    const jobs = [...this.publishQueue];
    this.publishQueue = [];

    for (const job of jobs) {
      try {
        await job.fn();
      } catch (error) {
        console.error("Mock publish queue error:", error);
      }
    }
  }

  getCheckQueueSize(): number {
    return this.checkQueue.length;
  }

  getPublishQueueSize(): number {
    return this.publishQueue.length;
  }

  clear(): void {
    this.checkQueue = [];
    this.publishQueue = [];
    this.enqueuedRelays.clear();
  }
}

/**
 * Mock Nocap for testing relay checks without actual network calls
 */
export class MockNocap {
  constructor(
    public url: string,
    public options: any = {}
  ) {}

  async useAdapters(_adapters: any[]): Promise<void> {
    // No-op
  }

  async check(checks: string[]): Promise<any> {
    // Return a mock successful check result
    const result: any = {
      url: this.url,
      hostname: new URL(this.url).hostname,
      protocol: new URL(this.url).protocol,
      checked_at: Date.now()
    };

    if (checks.includes("open")) {
      result.open = { data: true, duration: 100 };
    }

    if (checks.includes("read")) {
      result.read = { data: true, duration: 50 };
    }

    if (checks.includes("write")) {
      result.write = { data: true, duration: 75 };
    }

    if (checks.includes("info")) {
      result.info = {
        data: {
          name: `Mock Relay - ${this.url}`,
          description: "Mock relay for testing",
          pubkey: "mock-pubkey",
          supported_nips: [1, 2, 11]
        },
        duration: 60
      };
    }

    if (checks.includes("dns")) {
      result.dns = {
        data: { address: "1.2.3.4" },
        duration: 20
      };
    }

    if (checks.includes("geo")) {
      result.geo = {
        data: { country: "US", city: "Test City" },
        duration: 30
      };
    }

    if (checks.includes("ssl")) {
      result.ssl = {
        data: { valid: true, issuer: "Test CA" },
        duration: 40
      };
    }

    return result;
  }
}

/**
 * Mock Nocap that simulates offline relay
 */
export class MockNocapOffline extends MockNocap {
  override async check(checks: string[]): Promise<any> {
    const result: any = {
      url: this.url,
      hostname: new URL(this.url).hostname,
      protocol: new URL(this.url).protocol,
      checked_at: Date.now(),
      open: { data: false, duration: 3000, error: new Error("Connection timeout") }
    };

    return result;
  }
}

/**
 * Mock Publisher for testing event publishing
 */
export class MockPublisher {
  public publishedEvents: any[] = [];
  public shouldFail: boolean = false;
  public failCount: number = 0;

  constructor(
    public pubkey: string,
    public relays: string[]
  ) {}

  async publishEvent(event: any): Promise<string[]> {
    if (this.shouldFail && this.failCount > 0) {
      this.failCount--;
      throw new Error("Mock publish failure");
    }

    this.publishedEvents.push(event);
    return this.relays;
  }

  getPublishedEvents(): any[] {
    return this.publishedEvents;
  }

  reset(): void {
    this.publishedEvents = [];
    this.shouldFail = false;
    this.failCount = 0;
  }

  setFailure(shouldFail: boolean, failCount: number = 1): void {
    this.shouldFail = shouldFail;
    this.failCount = failCount;
  }
}

/**
 * Mock SimplePool for testing Nostr event fetching
 */
export class MockSimplePool {
  private events: Map<number, any[]> = new Map();

  constructor() {
    // Initialize with empty arrays for common kinds
    this.events.set(10002, []);
    this.events.set(10006, []);
    this.events.set(30166, []);
  }

  async querySync(relays: string[], filter: any): Promise<any[]> {
    const kind = filter.kinds?.[0];
    const events = this.events.get(kind) || [];

    // Filter by authors if specified
    if (filter.authors && filter.authors.length > 0) {
      return events.filter(e => filter.authors.includes(e.pubkey));
    }

    // Apply limit
    if (filter.limit && events.length > filter.limit) {
      return events.slice(0, filter.limit);
    }

    return events;
  }

  async publish(relays: string[], event: any): Promise<any> {
    const kind = event.kind;
    if (!this.events.has(kind)) {
      this.events.set(kind, []);
    }
    this.events.get(kind)?.push(event);
    return event;
  }

  addEvent(event: any): void {
    const kind = event.kind;
    if (!this.events.has(kind)) {
      this.events.set(kind, []);
    }
    this.events.get(kind)?.push(event);
  }

  close(relays: string[]): void {
    // No-op
  }

  reset(): void {
    this.events.clear();
    this.events.set(10002, []);
    this.events.set(10006, []);
    this.events.set(30166, []);
  }
}

/**
 * Mock Database for testing without actual SQLite
 */
export class MockDatabase {
  private data: Map<string, any[]> = new Map();

  constructor() {
    this.data.set("relay_status", []);
    this.data.set("relay_info", []);
  }

  query(sql: string, params: any[] = []): any[] {
    // Simple mock implementation
    if (sql.includes("SELECT")) {
      const tableName = this.extractTableName(sql);
      return this.data.get(tableName) || [];
    } else if (sql.includes("INSERT")) {
      const tableName = this.extractTableName(sql);
      const table = this.data.get(tableName) || [];
      table.push(params);
      this.data.set(tableName, table);
      return [];
    } else if (sql.includes("UPDATE")) {
      // Simple UPDATE mock
      return [];
    } else if (sql.includes("DELETE")) {
      const tableName = this.extractTableName(sql);
      this.data.set(tableName, []);
      return [];
    }
    return [];
  }

  private extractTableName(sql: string): string {
    const match = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    return match ? match[1] : "unknown";
  }

  addRow(table: string, row: any): void {
    const data = this.data.get(table) || [];
    data.push(row);
    this.data.set(table, data);
  }

  getRows(table: string): any[] {
    return this.data.get(table) || [];
  }

  reset(): void {
    this.data.clear();
    this.data.set("relay_status", []);
    this.data.set("relay_info", []);
  }
}

/**
 * Create a mock logger that doesn't output during tests
 */
export function createMockLogger(moduleName: string = "Mock") {
  return {
    debug: (_message: string, _context?: any) => {},
    info: (_message: string, _context?: any) => {},
    warn: (_message: string, _context?: any) => {},
    error: (_message: string, _context?: any) => {},
    setLevel: (_level: any) => {}
  };
}

/**
 * Export commonly used mock instances
 */
export const mockQueueManager = new MockQueueManager();
export const mockPublisher = new MockPublisher("test-pubkey", ["wss://relay.test.com"]);
export const mockSimplePool = new MockSimplePool();
export const mockDatabase = new MockDatabase();
