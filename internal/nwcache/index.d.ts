declare module '@nostrwatch/nwcache' {
  interface Relay {
    url: string;
    [key: string]: any
  }

  interface RelayGet {
    online: (key: string) => Promise<string[]>;
    all: () => Promise<Relay[]>;
  }

  interface DbWrapper {
    relay: RelayGet;
  }

  interface DbOptions {
    maxDbs: number;
  }

  export function openDb(path: string, options?: DbOptions): any;
  export class DbWrapper {
    constructor(lmdb: any);
    relay: RelayGet;
  }
  export function initializeDb(db: DbWrapper): DbWrapper;

  export default function(_lmdb: string, opts?: Record<string, any>): any;
}