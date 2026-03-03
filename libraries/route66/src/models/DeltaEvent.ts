/**
 * DeltaEvent Model
 *
 * Wraps Kind 1066 delta events with convenient accessors for relay state changes.
 * These events track relay status transitions, RTT measurements, and configuration changes.
 */

import { IEvent, NostrEvent, NostrTag } from './Event';

/**
 * Operational status values for relay liveness transitions
 */
export type OperationalStatus = 'init' | 'down' | 'up';

/**
 * DeltaEvent - Model for Kind 1066 delta events
 *
 * Kind 1066 events capture incremental changes to relay state over time.
 * They are used to build time series data for RTT charts, uptime timelines, etc.
 *
 * @example
 * ```typescript
 * const deltaEvent = new DeltaEvent(eventJson);
 * console.log(deltaEvent.relay);            // 'wss://relay.example.com'
 * console.log(deltaEvent.operationalStatus); // 'up' | 'down' | 'init' | null
 * console.log(deltaEvent.rtt);              // 150 (milliseconds)
 * console.log(deltaEvent.online);           // true
 * ```
 */
export class DeltaEvent extends NostrEvent implements IEvent {
  static readonly KIND = 1066;

  static keys = [
    'id',
    'relay',
    'monitorPubkey',
    'created_at',
    'operationalStatus',
    'rtt',
    'retryCount',
    'periods',
    'online',
  ];

  constructor(event: IEvent) {
    super(event);
    if (event.kind !== DeltaEvent.KIND) {
      console.warn(`[DeltaEvent] Expected kind ${DeltaEvent.KIND}, got ${event.kind}`);
    }
  }

  /**
   * Relay URL this delta event pertains to
   */
  get relay(): string | null {
    return this.tags.find((tag: NostrTag) => tag[0] === 'r')?.[1] || null;
  }

  /**
   * Alias for relay URL
   */
  get url(): string | null {
    return this.relay;
  }

  /**
   * Monitor pubkey that published this event
   */
  get monitorPubkey(): string {
    return this.pubkey;
  }

  /**
   * Operational status transition (init, up, down)
   * Only present when status changes
   */
  get operationalStatus(): OperationalStatus | null {
    const status = this.tags.find((tag: NostrTag) => tag[0] === 'status' || tag[0] === 'O')?.[1];
    if (status === 'init' || status === 'up' || status === 'down') {
      return status;
    }
    return null;
  }

  /**
   * RTT (Round Trip Time) for connection open in milliseconds
   */
  get rtt(): number | null {
    const rtt = this.tags.find((tag: NostrTag) => tag[0] === 'rtt-open')?.[1];
    return rtt ? parseInt(rtt, 10) : null;
  }

  /**
   * Retry count for offline relays
   */
  get retryCount(): number | null {
    const count = this.tags.find((tag: NostrTag) => tag[0] === 'retry-count')?.[1];
    return count ? parseInt(count, 10) : null;
  }

  /**
   * Time periods this event represents (e.g., '1h', '24h', '7d')
   */
  get periods(): string[] {
    return this.tags
      .filter((tag: NostrTag) => tag[0] === 'T')
      .map((tag: NostrTag) => tag[1]);
  }

  /**
   * Whether the relay is online based on operational status
   * Returns true for 'up' or 'init', false for 'down'
   */
  get online(): boolean {
    const status = this.operationalStatus;
    if (status === 'up' || status === 'init') {
      return true;
    }
    if (status === 'down') {
      return false;
    }
    // If no status transition, check if RTT is present (implies online)
    return this.rtt !== null;
  }

  /**
   * Check if this event represents a status transition
   */
  get isStatusTransition(): boolean {
    return this.operationalStatus !== null;
  }

  /**
   * Get all delta changes from this event
   * Returns an array of {key, value, type} objects
   */
  get deltas(): Array<{ key: string; value: string; type: 'add' | 'remove' | 'change' }> {
    const deltas: Array<{ key: string; value: string; type: 'add' | 'remove' | 'change' }> = [];

    for (const tag of this.tags) {
      if (tag[0] === '+' && tag.length >= 3) {
        deltas.push({ key: tag[1], value: tag[2], type: 'add' });
      } else if (tag[0] === '-' && tag.length >= 2) {
        deltas.push({ key: tag[1], value: tag[2] || '', type: 'remove' });
      } else if (tag[0] === '~' && tag.length >= 3) {
        deltas.push({ key: tag[1], value: tag[2], type: 'change' });
      }
    }

    return deltas;
  }
}
