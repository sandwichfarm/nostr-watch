export interface ICount {
  [key: string]: number;

}

export type ICounts = {
  [key: string]: ICount;
}

export class Counter {
  checks: Record<string, string[]>;  // Update checks type
  $session: any;
  counts: ICounts;

  constructor($session: any, checks: string[]) {
    this.checks = {};  // Initialize as an empty object instead of an array
    this.$session = $session;
    this.counts = {};
    this.init(checks);  // Pass checks to the init method
  }

  init(checks: string[]): void {
    checks.forEach((check: string) => {
      this.setup();
      (this as any)[check] = {
        add: (count: number) => this.add(check, count),
        subtract: (count: number) => this.subtract(check, count),
        get: () => this.get(check),
      };
    });
  }

  add(check: string, count: number): void {
    this.setup();
    if (!this.checks[this.session].includes(check)) {
      throw new Error(`Invalid check ${check}`);
    }
    if (!this.counts[this.session][check]) {
      this.counts[this.session][check] = 0;
    }
    this.counts[this.session][check] += count;
  }

  subtract(check: string, count: number): void {
    this.setup();
    if (!this.checks[this.session].includes(check)) {
      throw new Error(`Invalid check ${check}`);
    }
    if (!this.counts[this.session][check]) {
      this.counts[this.session][check] = 0;
    }
    this.counts[this.session][check] -= count;
  }

  get(check: string): number {
    this.setup();
    if (!this.checks[this.session].includes(check)) {
      throw new Error(`Invalid check ${check}`);
    }
    return this.counts[this.session][check];
  }

  total(): number {
    this.setup();
    return this.checks[this.session].reduce(
      (total: number, check: string) => total + this.get(check as string),
      0
    );
  }

  get session(): string {
    return this.$session.get();
  }

  setup(): void {
    if (!this.checks[this.session]) {
      this.checks[this.session] = [];
    }
    if (!this.counts[this.session]) {
      this.counts[this.session] = {};
    }
  }
}
