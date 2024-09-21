import { performance } from 'perf_hooks';

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
    if (!this.begin?.[this.session()]) {
      this.begin[this.session()] = {};
    }
    this.begin[this.session()][key] = performance.now();
  }

  finish(key: string): void {
    if (!this.end?.[this.session()]) {
      this.end[this.session()] = {};
    }
    this.end[this.session()][key] = performance.now();
  }

  duration(key: string): number {
    return this.end[this.session()][key] - this.begin[this.session()][key];
  }
}
