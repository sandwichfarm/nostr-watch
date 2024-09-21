export class TimeoutHelper {
  session: any;
  timeouts: Record<string, Record<string, NodeJS.Timeout>>;

  constructor($session: any) {
    this.session = $session;
    this.timeouts = {};
  }

  setup(): void {
    this.timeouts = {};
  }

  reset(): void {
    this.setup();
  }

  get(key: string): NodeJS.Timeout | undefined {
    return this.timeouts[this.session.get()]?.[key];
  }

  has(key: string): boolean {
    return !!this.timeouts?.[this.session.get()]?.[key];
  }

  create(key: string, timeout: number = 1000, timeoutCb: () => void = () => {}): void {
    if (!this.timeouts?.[this.session.get()]) {
      this.timeouts[this.session.get()] = {};
    }
    this.timeouts[this.session.get()][key] = setTimeout(() => {
      if (timeoutCb instanceof Function) {
        try {
          timeoutCb();
        } catch (e) {
          throw new Error(`error in timeout callback for ${key}: ${(e as Error).message}`);
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
