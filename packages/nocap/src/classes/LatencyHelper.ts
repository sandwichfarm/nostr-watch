import { SessionHelper } from "./SessionHelper";

export class LatencyHelper {
  private begin: Record<string, Record<string, number>>;
  private end: Record<string, Record<string, number>>;
  private $session: SessionHelper; // Assuming `$session` has method `get`

  constructor($Session: SessionHelper) {
    this.$session = $Session;
    this.setup();
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
    const session = this.session();
    if (!this.begin[session]) {
      this.begin[session] = {};
    }
    this.begin[session][key] = Date.now();
  }

  finish(key: string): void {
    const session = this.session();
    if (!this.end[session]) {
      this.end[session] = {};
    }
    this.end[session][key] = Date.now();
  }

  duration(key: string): number {
    return this.end[this.session()][key] - this.begin[this.session()][key];
  }
}