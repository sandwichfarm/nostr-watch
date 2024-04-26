import { SessionHelper } from "./SessionHelper";

export class TimeoutHelper {
  private session: SessionHelper; // Assuming `session` has method `get`
  private timeouts: Record<string, Record<string, NodeJS.Timeout>>;

  constructor($session: any) {
    this.session = $session;
    this.setup();
  }

  setup(): void {
    this.timeouts = {};
  }

  reset(): void {
    this.setup();
  }

  get(key: string): NodeJS.Timeout {
    return this.timeouts[this.session.get()][key];
  }

  has(key: string): boolean {
    return !!this.timeouts?.[this.session.get()]?.[key];
  }

  create(key: string, timeout: number = 1000, timeoutCb: () => void = () => {}): void {
    const session = this.session.get();
    if (!this.timeouts[session]) {
      this.timeouts[session] = {};
    }
    this.timeouts[session][key] = setTimeout(() => {
      if (timeoutCb instanceof Function) {
        try {
          timeoutCb();
        } catch (e) {
          throw new Error(`error in timeout callback for ${key}: ${e.message}`);
        }
      }
    }, timeout);
  }

  async delay(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  clear(key: string): void {
    clearTimeout(this.timeouts[this.session.get()][key]);
  }
}