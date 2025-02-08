import { get } from 'svelte/store';
import { tabState, type TabStateType } from '$stores/app';

export type ActivityState = 'leader' | 'follower' | 'idle' | 'inactive';

interface LifecycleMessage {
  type: 'leader-claimed' | 'request-leader-release' | 'leader-released';
  payload?: Record<string, any>;
  sourceId: string;
}

/**  
 * A simple delay helper.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class ActivityManager {
  private currentState: ActivityState;
  private transitioning: boolean = false; // Guard flag to prevent overlapping transitions

  // External handlers now return Promise<void>
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
  // Forced takeover timeout: 1000 ms.
  private releaseWaitTimeoutId: number | null = null;
  private releaseWaitTimeoutMs: number = 500;

  // Delay before firing the active callback after claiming leadership.
  private LEADERSHIP_CONFIRM_DELAY_MS: number = 200;

  // When the document becomes hidden, wait this many milliseconds before marking inactive.
  private HIDDEN_DELAY_MS: number = 3000;

  // Heartbeat: update leader timestamp every second.
  private heartbeatIntervalId: number | null = null;
  private HEARTBEAT_INTERVAL_MS: number = 1000;
  // If the leader’s timestamp is older than this threshold, it’s considered stale.
  private STALE_THRESHOLD_MS: number = 2500;

  private boundVisibilityHandler: () => void;
  private boundIdleEventHandler: (e: Event) => void;
  private boundChannelMessageHandler: (ev: MessageEvent) => void;
  private boundBeforeUnloadHandler: () => void;

  // We'll store a timeout ID for the delayed hidden action.
  private visibilityHiddenTimeoutId: number | null = null;

  constructor(idleTimeoutMs: number = 5 * 60 * 1000) {
    this.idleTimeoutMs = idleTimeoutMs;

    // Initialize state based on document visibility.
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

    if (document.visibilityState === 'visible') {
      this.onActivity();
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
   * If a transition is already in progress, this call is skipped.
   * The external handler for the new state is awaited before updating the state.
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
      void this.onIdle(); // fire-and-forget
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
    this.startIdleTimer();
  }

  private async handleVisibilityChange() {
    console.log('ActivityManager: Visibility changed:', document.visibilityState);
    if (document.visibilityState === 'hidden') {
      // Instead of acting immediately, wait a bit before transitioning.
      if (this.visibilityHiddenTimeoutId) {
        clearTimeout(this.visibilityHiddenTimeoutId);
      }
      this.visibilityHiddenTimeoutId = window.setTimeout(async () => {
        if (document.visibilityState === 'hidden') {
          if (this.isLeader) {
            await this.releaseLeadership();
          } else {
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
            await this.transitionState('inactive');
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
        // Update the timestamp so that other tabs can detect a stale leader.
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

  private async acquireLeadership() {
    if (this.isLeader) return;

    // On a page refresh, clear any stale leader.
    if (
      document.visibilityState === 'visible' &&
      performance.getEntriesByType('navigation')[0]?.type === 'reload'
    ) {
      console.log('ActivityManager: Detected page refresh; clearing stale leader.');
      localStorage.removeItem('leaderId');
    }

    let currentLeader: string | null = null;
    let leaderTimestamp: number | null = null;
    const leaderData = localStorage.getItem('leaderId');
    if (leaderData) {
      try {
        const parsed = JSON.parse(leaderData);
        currentLeader = parsed.id;
        leaderTimestamp = parsed.ts;
      } catch (e) {
        currentLeader = leaderData;
      }
    }

    if (
      document.visibilityState === 'visible' &&
      currentLeader &&
      currentLeader !== this.myId
    ) {
      if (leaderTimestamp && Date.now() - leaderTimestamp > this.STALE_THRESHOLD_MS) {
        console.log('ActivityManager: Detected stale leader. Clearing it.');
        localStorage.removeItem('leaderId');
        currentLeader = null;
      }
    }

    if (!currentLeader) {
      // Claim leadership and start heartbeat.
      this.leaderId = this.myId;
      this.isLeader = true;
      localStorage.setItem('leaderId', JSON.stringify({ id: this.myId, ts: Date.now() }));
      this.sendMessage('leader-claimed', { leaderId: this.myId });
      await delay(this.LEADERSHIP_CONFIRM_DELAY_MS);
      await this.transitionState('leader');
      this.startHeartbeat();
    } else if (currentLeader !== this.myId) {
      this.leaderId = currentLeader;
      this.sendMessage('request-leader-release', { requestingId: this.myId });
      this.releaseWaitTimeoutId = window.setTimeout(async () => {
        console.warn('ActivityManager: Forcibly taking leadership after timeout.');
        localStorage.removeItem('leaderId');
        await this.acquireLeadership();
      }, this.releaseWaitTimeoutMs);
      await this.transitionState('inactive');
    } else {
      this.isLeader = true;
      await this.transitionState('leader');
      this.startHeartbeat();
    }
  }

  private clearReleaseWaitTimeout() {
    if (this.releaseWaitTimeoutId !== null) {
      clearTimeout(this.releaseWaitTimeoutId);
      this.releaseWaitTimeoutId = null;
    }
  }

  private async releaseLeadership() {
    if (!this.isLeader) return;
    this.sendMessage('leader-released', { oldLeaderId: this.myId });
    const leaderData = localStorage.getItem('leaderId');
    if (leaderData) {
      try {
        const parsed = JSON.parse(leaderData);
        if (parsed.id === this.myId) {
          localStorage.removeItem('leaderId');
        }
      } catch (e) {
        if (leaderData === this.myId) {
          localStorage.removeItem('leaderId');
        }
      }
    }
    this.isLeader = false;
    this.clearHeartbeat();
    if (this.currentState !== 'inactive') {
      await this.transitionState('inactive');
    }
  }

  private async handleBeforeUnload() {
    if (this.isLeader) {
      await this.releaseLeadership();
    }
  }

  // Public API: register an asynchronous handler.
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
