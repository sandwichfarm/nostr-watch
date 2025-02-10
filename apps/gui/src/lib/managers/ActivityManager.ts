import { get } from 'svelte/store';
import { tabState, type TabStateType } from '$stores/app';

export type ActivityState = 'leader' | 'follower' | 'idle' | 'inactive';

interface LifecycleMessage {
  type:
    | 'leader-claimed'
    | 'request-leader-release'
    | 'leader-released'
    | 'shutdown-complete';
  payload?: Record<string, any>;
  sourceId: string;
}

/** A simple delay helper. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class ActivityManager {
  private currentState: ActivityState;
  private transitioning: boolean = false;

  // External handlers return Promise<void>
  private externalHandlers: { active: () => Promise<void>; inactive: () => Promise<void> } = {
    active: async () => {},
    inactive: async () => {},
  };

  private idleTimeoutMs: number;
  private idleTimer: number | null = null;

  private channel: BroadcastChannel | null = null;
  private myId: string;
  private leaderId: string | null = null;
  private isLeader: boolean = false;
  private releaseWaitTimeoutId: number | null = null;
  private releaseWaitTimeoutMs: number = 500;

  // Reduced leadership confirmation delay.
  private LEADERSHIP_CONFIRM_DELAY_MS: number = 500;
  // Reduced hidden delay.
  private HIDDEN_DELAY_MS: number = 3000;

  // Heartbeat settings.
  private heartbeatIntervalId: number | null = null;
  private HEARTBEAT_INTERVAL_MS: number = 1000;
  private STALE_THRESHOLD_MS: number = 5000;

  private boundVisibilityHandler: () => void;
  private boundIdleEventHandler: (e: Event) => void;
  private boundChannelMessageHandler: (ev: MessageEvent) => void;
  private boundBeforeUnloadHandler: () => void;

  // Timeout ID for delayed hidden action.
  private visibilityHiddenTimeoutId: number | null = null;

  constructor(idleTimeoutMs: number = 5 * 60 * 1000) {
    this.idleTimeoutMs = idleTimeoutMs;
    // Initialize state: if visible, start as follower (not yet leader), otherwise inactive.
    this.currentState =
      document.visibilityState === 'visible' ? 'follower' : 'inactive';
    this.updateTabState(this.currentState);
    this.myId = crypto.randomUUID();

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('myAppLifecycle');
      this.boundChannelMessageHandler = this.handleChannelMessage.bind(this);
      this.channel.addEventListener('message', this.boundChannelMessageHandler);
    }

    this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);

    this.boundIdleEventHandler = this.resetIdleTimer.bind(this);
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(
      eventName => {
        window.addEventListener(eventName, this.boundIdleEventHandler, true);
      }
    );

    this.boundBeforeUnloadHandler = this.handleBeforeUnload.bind(this);
    window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);

    this.startIdleTimer();

    // Delay the initial onActivity() to allow external handler registration.
    if (document.visibilityState === 'visible') {
      setTimeout(() => { this.onActivity(); }, 0);
    }
  }

  private updateTabState(newState: TabStateType) {
    if (get(tabState) !== newState) {
      tabState.update(() => newState);
      console.log(`Tab state updated to: ${newState}`);
    }
  }

  // We define "active" as being the leader.
  private isActiveState(state: ActivityState): boolean {
    return state === 'leader';
  }

  /**
   * Transition to a new state.
   * Awaits the external active/inactive handler before updating the state.
   */
  private async transitionState(newState: ActivityState) {
    if (this.transitioning || this.currentState === newState) return;
    this.transitioning = true;
    console.log(`ActivityManager: Transitioning from ${this.currentState} to ${newState}`);
    if (this.isActiveState(newState)) {
      await this.externalHandlers.active();
    } else {
      await this.externalHandlers.inactive();
    }
    this.currentState = newState;
    this.updateTabState(newState);
    this.transitioning = false;
  }

  private startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = window.setTimeout(() => {
      void this.onIdle();
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer() {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async resetIdleTimer() {
    if (this.currentState === 'idle' || this.currentState === 'inactive') {
      await this.onActivity();
    }
    this.startIdleTimer();
  }

  private async onIdle() {
    console.log('ActivityManager: User is idle.');
    if (this.isLeader) {
      await this.releaseLeadership();
    }
    if (document.visibilityState !== 'visible') {
      await this.transitionState('inactive');
    } else {
      await this.transitionState('idle');
    }
  }

  private async onActivity() {
    if (document.visibilityState !== 'visible') return;
    console.log('ActivityManager: User is active.');
    await this.acquireLeadership();
    // Immediately re-read stored leader to update UX state:
    const stored = localStorage.getItem('leaderId');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id !== this.myId) {
          await this.transitionState('follower');
        } else {
          await this.transitionState('leader');
        }
      } catch (e) {
        await this.transitionState('leader');
      }
    } else {
      await this.transitionState('leader');
    }
    this.startIdleTimer();
  }

  private async handleVisibilityChange() {
    console.log('ActivityManager: Visibility changed:', document.visibilityState);
    if (document.visibilityState === 'hidden') {
      if (this.visibilityHiddenTimeoutId) {
        clearTimeout(this.visibilityHiddenTimeoutId);
      }
      this.visibilityHiddenTimeoutId = window.setTimeout(async () => {
        if (document.visibilityState === 'hidden') {
          if (this.isLeader) {
            await this.releaseLeadership();
          } else {
            // For visible tabs that are not leader, you want to display "follower"
            await this.transitionState('inactive');
          }
          this.clearIdleTimer();
        }
      }, this.HIDDEN_DELAY_MS);
    } else if (document.visibilityState === 'visible') {
      if (this.visibilityHiddenTimeoutId) {
        clearTimeout(this.visibilityHiddenTimeoutId);
        this.visibilityHiddenTimeoutId = null;
      }
      await this.onActivity();
    }
  }

  private async handleChannelMessage(ev: MessageEvent) {
    const message: LifecycleMessage = ev.data;
    if (message.sourceId === this.myId) return;
    switch (message.type) {
      case 'leader-claimed': {
        const newLeaderId = message.payload?.leaderId as string;
        this.leaderId = newLeaderId;
        if (newLeaderId === this.myId) {
          this.isLeader = true;
          await delay(this.LEADERSHIP_CONFIRM_DELAY_MS);
          await this.transitionState('leader');
        } else {
          this.isLeader = false;
          if (document.visibilityState === 'visible') {
            // Change: update to "follower" (instead of "inactive")
            await this.transitionState('follower');
          }
        }
        this.clearReleaseWaitTimeout();
        break;
      }
      case 'request-leader-release': {
        if (this.isLeader) {
          console.log('ActivityManager: Received request to release leadership.');
          await this.releaseLeadership();
        }
        break;
      }
      case 'leader-released': {
        if (!this.isLeader && document.visibilityState === 'visible') {
          await delay(100);
          await this.acquireLeadership();
        }
        break;
      }
      case 'shutdown-complete': {
        console.log('ActivityManager: Received shutdown-complete.');
        await delay(100);
        await this.acquireLeadership();
        break;
      }
      default:
        break;
    }
  }

  private sendMessage(
    type: LifecycleMessage['type'],
    payload: Record<string, any> = {}
  ) {
    const message: LifecycleMessage = {
      type,
      payload,
      sourceId: this.myId,
    };
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatIntervalId = window.setInterval(() => {
      if (this.isLeader) {
        localStorage.setItem('leaderId', JSON.stringify({ id: this.myId, ts: Date.now() }));
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat() {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * acquireLeadership():
   * - If any leader exists (even if valid), force a takeover by sending a release request and clearing the entry.
   * - Then claim leadership.
   */
  private async acquireLeadership() {
    if (this.isLeader) return;
  
    if (
      document.visibilityState === 'visible' &&
      performance.getEntriesByType('navigation')[0]?.type === 'reload'
    ) {
      console.log('ActivityManager: Detected page refresh; clearing stale leader.');
      localStorage.removeItem('leaderId');
    }
  
    // Check if any leader exists.
    const leaderData = localStorage.getItem('leaderId');
    if (leaderData) {
      let parsed: { id?: string; shutdown?: boolean } = {};
      try {
        parsed = JSON.parse(leaderData);
      } catch (e) {}
      const currentLeader = parsed.id;
      if (currentLeader && currentLeader !== this.myId) {
        if (!parsed.shutdown) {
          console.log('ActivityManager: Forcing takeover (release request sent) because current leader is', currentLeader);
          this.sendMessage('request-leader-release', { requestingId: this.myId });
          await delay(250);
          localStorage.removeItem('leaderId');
        }
      }
    }
  
    // Claim leadership.
    localStorage.setItem('leaderId', JSON.stringify({ id: this.myId, ts: Date.now() }));
    this.leaderId = this.myId;
    this.isLeader = true;
    this.sendMessage('leader-claimed', { leaderId: this.myId });
    await this.transitionState('leader');
    this.startHeartbeat();
  }
  
  private clearReleaseWaitTimeout() {
    if (this.releaseWaitTimeoutId !== null) {
      clearTimeout(this.releaseWaitTimeoutId);
      this.releaseWaitTimeoutId = null;
    }
  }
  
  /**
   * releaseLeadership():
   * - Marks shutdown, sends a release message, awaits the external inactive handler, then clears the leader entry.
   */
  private async releaseLeadership() {
    if (!this.isLeader) return;
    localStorage.setItem('leaderId', JSON.stringify({ id: this.myId, ts: Date.now(), shutdown: true }));
    this.sendMessage('leader-released', { oldLeaderId: this.myId });
    await this.transitionState('inactive');
    localStorage.removeItem('leaderId');
    this.sendMessage('shutdown-complete', {});
    this.isLeader = false;
    this.clearHeartbeat();
  }
  
  private async handleBeforeUnload() {
    if (this.isLeader) {
      await this.releaseLeadership();
    }
  }
  
  public on(which: 'active' | 'inactive', handler: () => Promise<void>) {
    this.externalHandlers[which] = handler;
    if (which === 'active' && this.isActiveState(this.currentState)) {
      handler();
    }
  }
  
  public destroy() {
    this.clearIdleTimer();
    if (this.channel) {
      this.channel.removeEventListener('message', this.boundChannelMessageHandler);
      this.channel.close();
    }
    document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(eventName => {
      window.removeEventListener(eventName, this.boundIdleEventHandler, true);
    });
    window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
  }
}
