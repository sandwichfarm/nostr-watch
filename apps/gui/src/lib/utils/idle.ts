type IdleCallback = () => void;

interface IdleDetectorOptions {
  idleTimeoutMs?: number;
  onIdle?: IdleCallback;
  onActive?: IdleCallback;
}

export class IdleDetector {
  private idleTimeoutMs: number;
  private onIdle?: IdleCallback;
  private onActive?: IdleCallback;
  private idleTimer: number | null = null;
  private isIdle: boolean = false;

  constructor(options: IdleDetectorOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 300000;
    this.onIdle = options.onIdle;
    this.onActive = options.onActive;

    this.resetTimer = this.resetTimer.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.init();
  }

  private init() {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    events.forEach((event) => {
      window.addEventListener(event, this.resetTimer, true);
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.startTimer();
  }

  private startTimer() {
    this.clearTimer();
    this.idleTimer = window.setTimeout(() => this.goIdle(), this.idleTimeoutMs);
  }

  private clearTimer() {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private resetTimer() {
    if (this.isIdle) {
      this.isIdle = false;
      this.onActive && this.onActive();
    }
    this.startTimer();
  }

  private goIdle() {
    this.isIdle = true;
    this.onIdle && this.onIdle();
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.clearTimer();
    } else {
      this.resetTimer();
    }
  }

  public destroy() {
    this.clearTimer();
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((event) => {
      window.removeEventListener(event, this.resetTimer, true);
    });
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public reset() {
    this.resetTimer();
  }
}
