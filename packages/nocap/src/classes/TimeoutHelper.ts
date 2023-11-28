export class TimeoutHelper {
  private session: any; // TODO: Define specific type for $session
  private timeouts: Record<string, Record<string, number | NodeJS.Timeout>>;
  private logger: any; // TODO: Define specific type for logger

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

  create(key: string, timeout: number = 1000, timeoutCb: () => void = () => {}): void {
    const sessionKey = this.session.get();
    if (!this.timeouts[sessionKey]) {
      this.timeouts[sessionKey] = {};
    }
    this.timeouts[sessionKey][key] = setTimeout(() => {
      if (timeoutCb instanceof Function) {
        try {
          timeoutCb();
        } catch (e: any) { // TODO: Define specific error type if available
          this.logger.error(`error in timeout callback for ${key}: ${e.message}`);
        }
      }
    }, timeout);
  }

  async delay(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  clear(key: string): void {
    const sessionKey = this.session.get();
    const timeout = this.timeouts[sessionKey][key];
    if (typeof timeout !== 'undefined') {
      clearTimeout(timeout as number); // Casting to `number` for browser compatibility
    }
  }
}
