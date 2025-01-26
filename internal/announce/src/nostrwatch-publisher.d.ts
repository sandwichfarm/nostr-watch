// src/nostrwatch-publisher.d.ts
declare module '@nostrwatch/publisher' {
  export class Publisher {
    constructor(pubkey: string | null, relays: string[]);
    publishEvent(event: any): Promise<any>[];
  }

  export class Kind10166 {
    constructor(pubkey: string | null);
    generateEvent(args: any): any;
    event: any;
  }

  export class Kind0 {
    constructor(pubkey: string | null);
    generateEvent(args: any): any;
    event: any;
  }

  export class Kind10002 {
    constructor(pubkey: string | null);
    generateEvent(args: any): any;
    event: any;
  }
}
