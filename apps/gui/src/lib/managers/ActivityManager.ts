import { get } from 'svelte/store';
import { tabState, type TabStateType } from '$stores/app';

export type ActivityState = 'leader' | 'follower';

type LeaderStorageRecord = { id: string; ts: number; shutdown?: boolean };

interface LifecycleMessage {
  type: 'leader-claimed' | 'leader-released';
  payload?: Record<string, any>;
  sourceId: string;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseLeaderStorage(raw: string | null): LeaderStorageRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LeaderStorageRecord;
    if (!parsed?.id || !parsed?.ts) return null;
    return parsed;
  } catch {
    return null;
  }
}

export class ActivityManager {
  private currentState: ActivityState = 'follower';
  private transitioning = false;

  private externalHandlers: {
    leader: () => Promise<void>;
    follower: () => Promise<void>;
  } = {
    leader: async () => {},
    follower: async () => {},
  };

  private channel: BroadcastChannel | null = null;
  private myId: string;
  private isLeader = false;
  private destroyed = false;

  private leaderLockRelease: (() => void) | null = null;
  private readonly LOCK_NAME = 'nostrwatch:route66-leader';

  private heartbeatIntervalId: number | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 1000;
  private readonly STALE_THRESHOLD_MS = 5000;

  private leaderWatchIntervalId: number | null = null;
  private readonly LEADER_CONFIRM_DELAY_MS = 100;

  private readonly STORAGE_KEY = 'leaderId';

  private readonly boundChannelMessageHandler: (ev: MessageEvent) => void;
  private readonly boundBeforeUnloadHandler: () => void;
  private readonly boundVisibilityHandler: () => void;

  constructor(_idleTimeoutMs: number = 5 * 60 * 1000) {
    this.myId = crypto.randomUUID();

    this.boundChannelMessageHandler = this.handleChannelMessage.bind(this);
    this.boundBeforeUnloadHandler = this.handleBeforeUnload.bind(this);
    this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);

    this.updateTabState('follower');

    // Prefer Web Locks API where available (strong single-leader guarantee).
    const locks = (navigator as any)?.locks as { request?: Function } | undefined;
    if (typeof locks?.request === 'function') {
      void this.runWebLocksElection();
      return;
    }

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('myAppLifecycle');
      this.channel.addEventListener('message', this.boundChannelMessageHandler);
    }

    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);

    this.startLeaderWatch();

    // Attempt leadership as soon as possible in visible tabs.
    if (document.visibilityState === 'visible') {
      setTimeout(() => void this.acquireLeadership(), 0);
    }
  }

  private updateTabState(newState: TabStateType) {
    if (get(tabState) !== newState) {
      tabState.update(() => newState);
    }
  }

  private async transitionState(newState: ActivityState) {
    if (this.transitioning || this.currentState === newState) return;
    this.transitioning = true;
    if (newState === 'leader') {
      await this.externalHandlers.leader();
    } else {
      await this.externalHandlers.follower();
    }
    this.currentState = newState;
    this.updateTabState(newState);
    this.transitioning = false;
  }

  private sendMessage(type: LifecycleMessage['type'], payload: Record<string, any> = {}) {
    const message: LifecycleMessage = { type, payload, sourceId: this.myId };
    this.channel?.postMessage(message);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatIntervalId = window.setInterval(() => {
      if (!this.isLeader) return;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ id: this.myId, ts: Date.now() }));
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private startLeaderWatch() {
    this.stopLeaderWatch();
    this.leaderWatchIntervalId = window.setInterval(() => {
      if (this.destroyed) return;
      if (this.isLeader) return;
      if (document.visibilityState !== 'visible') return;

      const leader = parseLeaderStorage(localStorage.getItem(this.STORAGE_KEY));
      if (!leader) {
        void this.acquireLeadership();
        return;
      }
      if (leader.shutdown) return;
      if (this.isStale(leader)) {
        try {
          localStorage.removeItem(this.STORAGE_KEY);
        } catch {}
        void this.acquireLeadership();
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopLeaderWatch() {
    if (this.leaderWatchIntervalId !== null) {
      clearInterval(this.leaderWatchIntervalId);
      this.leaderWatchIntervalId = null;
    }
  }

  private isStale(record: LeaderStorageRecord): boolean {
    return Date.now() - record.ts > this.STALE_THRESHOLD_MS;
  }

  private async becomeLeader() {
    if (this.isLeader) return;
    this.isLeader = true;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ id: this.myId, ts: Date.now() }));
    this.sendMessage('leader-claimed', { leaderId: this.myId });

    // In fallback mode, we may "race" other visible tabs. Confirm we actually won.
    await delay(this.LEADER_CONFIRM_DELAY_MS);
    const leader = parseLeaderStorage(localStorage.getItem(this.STORAGE_KEY));
    if (!leader || leader.id !== this.myId) {
      this.isLeader = false;
      await this.transitionState('follower');
      return;
    }

    await this.transitionState('leader');
    this.startHeartbeat();
  }

  private async becomeFollower(_leaderId?: string) {
    if (this.isLeader) {
      this.isLeader = false;
      this.stopHeartbeat();
    }
    await this.transitionState('follower');
  }

  private async acquireLeadership() {
    const leader = parseLeaderStorage(localStorage.getItem(this.STORAGE_KEY));
    if (leader && leader.id !== this.myId && !this.isStale(leader) && !leader.shutdown) {
      await this.becomeFollower(leader.id);
      return;
    }
    await this.becomeLeader();
  }

  private async releaseLeadership() {
    if (!this.isLeader) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ id: this.myId, ts: Date.now(), shutdown: true }));
    this.sendMessage('leader-released', { oldLeaderId: this.myId });
    localStorage.removeItem(this.STORAGE_KEY);
    this.isLeader = false;
    this.stopHeartbeat();
    await this.transitionState('follower');
  }

  private async handleChannelMessage(ev: MessageEvent) {
    const message: LifecycleMessage = ev.data;
    if (!message || message.sourceId === this.myId) return;

    if (message.type === 'leader-claimed') {
      // localStorage is the source of truth for who won the race in fallback mode.
      // Reconcile from storage to avoid split-brain or "both demote" outcomes.
      await this.acquireLeadership();
      return;
    }

    if (message.type === 'leader-released') {
      // Small delay to allow the old leader to finish teardown.
      await delay(100);
      if (document.visibilityState === 'visible') {
        await this.acquireLeadership();
      }
    }
  }

  private async handleVisibilityChange() {
    if ((navigator as any)?.locks?.request) return;
    if (document.visibilityState === 'visible') {
      await this.acquireLeadership();
    }
  }

  private async handleBeforeUnload() {
    if (this.isLeader) {
      await this.releaseLeadership();
    }
  }

  public on(which: 'leader' | 'follower', handler: () => Promise<void>) {
    this.externalHandlers[which] = handler;
    if (which === this.currentState) {
      handler();
    }
  }

  public destroy() {
    this.stopHeartbeat();
    this.stopLeaderWatch();
    this.destroyed = true;
    this.leaderLockRelease?.();
    this.leaderLockRelease = null;
    if (this.isLeader) {
      try {
        this.sendMessage('leader-released', { oldLeaderId: this.myId });
        localStorage.removeItem(this.STORAGE_KEY);
      } catch {}
      this.isLeader = false;
    }
    if (this.channel) {
      this.channel.removeEventListener('message', this.boundChannelMessageHandler);
      this.channel.close();
    }
    document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
    window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
  }

  private async runWebLocksElection() {
    const locks = (navigator as any)?.locks as { request?: Function } | undefined;
    if (typeof locks?.request !== 'function') return;

    while (!this.destroyed) {
      try {
        await locks.request(
          this.LOCK_NAME,
          { mode: 'exclusive' },
          async () => {
            this.isLeader = true;
            await this.transitionState('leader');

            await new Promise<void>((resolve) => {
              this.leaderLockRelease = resolve;
            });

            this.isLeader = false;
            await this.transitionState('follower');
          }
        );
      } catch {
        // ignore and retry
      }

      await delay(50);
    }
  }
}
