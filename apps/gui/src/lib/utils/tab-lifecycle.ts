type LifecycleEventType = 'leader-claimed' | 'request-leader-release' | 'leader-released';

interface LifecycleMessage {
  type: LifecycleEventType;
  payload?: Record<string, unknown>;
  sourceId: string;
}

interface TabLifecycleOptions {
  channelName?: string;
  releaseWaitTimeoutMs?: number;
  tabActivityTimeoutMs?: number; // New option
}

type Handler = () => Promise<void> | void;

export class TabLifecycle {
  private channelName: string;
  private releaseWaitTimeoutMs: number;
  private tabActivityTimeoutMs: number;
  private channel: BroadcastChannel | null = null;
  private myId: string;
  private leaderId: string | null = null;
  private isLeader = false;

  private onStartLeaderHandler: Handler = () => {};
  private onReleaseLeaderHandler: Handler = () => {};
  private onWaitForLeaderReleaseHandler: Handler = () => {};
  private onLeaderAcquiredHandler: Handler = () => {};
  private onTabActiveHandler: Handler = () => {};
  private onTabInactiveHandler: Handler = () => {};

  private releaseWaitTimeoutId: number | null = null;
  private tabActivityTimeoutId: number | null = null;

  constructor({
    channelName = 'myAppLifecycle',
    releaseWaitTimeoutMs = 5000,
    tabActivityTimeoutMs = 3000,
  }: TabLifecycleOptions = {}) {
    this.channelName = channelName;
    this.releaseWaitTimeoutMs = releaseWaitTimeoutMs;
    this.tabActivityTimeoutMs = tabActivityTimeoutMs;
    this.myId = crypto.randomUUID();

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (ev) => this.handleIncomingMessage(ev.data);
    } else {
      window.addEventListener('storage', (event) => {
        if (event.key === this.channelName && event.newValue) {
          const message = JSON.parse(event.newValue) as LifecycleMessage;
          this.handleIncomingMessage(message);
        }
      });
    }

    window.addEventListener('beforeunload', () => {
      if (this.isLeader) {
        this.clearLeader();
      }
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.onTabActive();
    } else if (document.visibilityState === 'hidden') {
      this.scheduleTabInactive();
    }
  };

  private scheduleTabInactive() {
    if (this.tabActivityTimeoutId) clearTimeout(this.tabActivityTimeoutId);
    this.tabActivityTimeoutId = window.setTimeout(() => {
      this.onTabInactive();
    }, this.tabActivityTimeoutMs);
  }

  private onTabActive() {
    if (this.tabActivityTimeoutId) clearTimeout(this.tabActivityTimeoutId);
    this.onTabActiveHandler();
  }

  public onTabInactive(fn: Handler) {
    this.onTabInactiveHandler = async () => {
      // Call the provided handler
      await fn();
  
      // If the tab is the leader, release leadership when inactive
      if (this.isLeader) {
        console.log('[TabLifecycle] Tab inactive, releasing leadership.');
        await this.releaseLeadership();
      }
    };
  }
  

  private sendMessage(type: LifecycleEventType, payload: Record<string, unknown> = {}): void {
    const message: LifecycleMessage = {
      type,
      payload,
      sourceId: this.myId,
    };
    if (this.channel) {
      this.channel.postMessage(message);
    } else {
      localStorage.setItem(this.channelName, JSON.stringify(message));
      setTimeout(() => {
        localStorage.removeItem(this.channelName);
      }, 50);
    }
  }

  private async handleIncomingMessage(message: LifecycleMessage) {
    const { type, payload, sourceId } = message;

    switch (type) {
      case 'leader-claimed': {
        const newLeaderId = payload?.leaderId as string;
        this.leaderId = newLeaderId;
        localStorage.setItem('leaderId', newLeaderId);
        if (this.leaderId === this.myId) {
          this.isLeader = true;
          await this.onStartLeaderHandler();
        }
        this.clearReleaseWaitTimeout();
        break;
      }

      case 'request-leader-release':
        if (this.isLeader && sourceId !== this.myId) {
          await this.releaseLeadership();
        }
        break;

      case 'leader-released':
        const oldLeaderId = payload?.oldLeaderId as string;
        if (!this.leaderId || this.leaderId === oldLeaderId) {
          this.leaderId = null;
          localStorage.removeItem('leaderId');
        }
        if (!this.isLeader) {
          this.clearReleaseWaitTimeout();
          this.leaderId = this.myId;
          this.isLeader = true;
          localStorage.setItem('leaderId', this.myId);
          await this.onLeaderAcquiredHandler();
          this.sendMessage('leader-claimed', { leaderId: this.myId });
        }
        break;
    }
  }

  public acquireLeadership() {
    const currentLeader = localStorage.getItem('leaderId');

    if (!currentLeader) {
      this.setAsLeader();
    } else if (currentLeader !== this.myId) {
      this.leaderId = currentLeader;
      this.onWaitForLeaderReleaseHandler();
      this.sendMessage('request-leader-release', { requestingId: this.myId });

      this.releaseWaitTimeoutId = window.setTimeout(() => {
        console.warn('No response from existing leader, forcibly taking leadership.');
        this.clearStaleLeaderAndTakeOver();
      }, this.releaseWaitTimeoutMs);
    } else {
      this.setAsLeader();
    }
  }

  private setAsLeader() {
    this.leaderId = this.myId;
    this.isLeader = true;
    localStorage.setItem('leaderId', this.myId);
    this.onStartLeaderHandler();
    this.sendMessage('leader-claimed', { leaderId: this.myId });
  }

  private clearStaleLeaderAndTakeOver() {
    localStorage.removeItem('leaderId');
    this.setAsLeader();
  }

  public async releaseLeadership() {
    if (this.isLeader) {
      await this.onReleaseLeaderHandler();
      this.sendMessage('leader-released', { oldLeaderId: this.myId });
      this.clearLeader();
    }
  }

  private clearLeader() {
    if (localStorage.getItem('leaderId') === this.myId) {
      localStorage.removeItem('leaderId');
    }
    this.leaderId = null;
    this.isLeader = false;
  }

  private clearReleaseWaitTimeout() {
    if (this.releaseWaitTimeoutId !== null) {
      clearTimeout(this.releaseWaitTimeoutId);
      this.releaseWaitTimeoutId = null;
    }
  }

  public onStartLeader(fn: Handler) {
    this.onStartLeaderHandler = fn;
  }

  public onReleaseLeader(fn: Handler) {
    this.onReleaseLeaderHandler = fn;
  }

  public onWaitForLeaderRelease(fn: Handler) {
    this.onWaitForLeaderReleaseHandler = fn;
  }

  public onLeaderAcquired(fn: Handler) {
    this.onLeaderAcquiredHandler = fn;
  }
}

export function createTabLifecycle(options?: TabLifecycleOptions): TabLifecycle {
  return new TabLifecycle(options);
}
