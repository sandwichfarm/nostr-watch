// Type declarations for external dependencies

declare module 'nostr-fetch' {
  export class NostrFetcher {
    static init(): NostrFetcher;
    constructor();
    fetchAllEvents(relays: string[], filter: any, options?: any): AsyncIterable<any>;
    shutdown(): void;
  }
}

declare module '@nostrwatch/utils' {
  export function parseRelayNetwork(url: string): string;
}

declare module '@nostrwatch/db' {
  export const db: {
    query(sql: string): any[];
  };
  export function initDB(path: string, enableWAL?: boolean): void;
  export function getSeederTimestamps(): Record<string, number>;
  export function seedNewRelay(relay: string, network: string): boolean;
  export function saveSeederTimestamp(method: string, timestamp: number): void;
}

declare module '@nostrwatch/nostrings' {
  interface Nostrings {
    sanitize: {
      relayUrls(urls: string[]): string[];
    };
  }
  
  const nostrings: Nostrings;
  export default nostrings;
} 