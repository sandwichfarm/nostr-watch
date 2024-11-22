import now from 'performance-now';

export class LatencyHelper {
  begin: Record<string, Record<string, number>>;
  end: Record<string, Record<string, number>>;
  $session: any;

  constructor($Session: any) {
    this.setup();
    this.$session = $Session;
    this.begin = {};
    this.end = {};
  }

  setup(): void {
    this.begin = {};
    this.end = {};
  }

  reset(): void {
    this.setup();
  }

  session(): string {
    return this.$session.get();
  }

  start(key: string): void {
    const sessionKey = this.session();
    if (!this.begin[sessionKey]) {
      this.begin[sessionKey] = {};
    }
    this.begin[sessionKey][key] = now();
  }

  finish(key: string): void {
    const sessionKey = this.session();
    if (!this.end[sessionKey]) {
      this.end[sessionKey] = {};
    }
    this.end[sessionKey][key] = now();
  }

  duration(key: string): number {
    const sessionKey = this.session();
    return this.end[sessionKey][key] - this.begin[sessionKey][key];
  }
}
