// Assume that you import your Nip66CheckEvent from its module.
import { Nip66CheckEvent } from "./Nip66CheckEvent";

/**
 * A context used to normalize RTT values globally.
 */
export interface NormalizationContext {
  globalMin: number;
  range: number;
}

/**
 * A RelayCheckAggregate retains a reference to a live array of Nip66CheckEvents
 * (for a given relay) and computes merged values on demand.
 *
 * - For keys not explicitly handled, it returns the first non-null value
 *   from the most recent event to the oldest.
 * - For derivative keys (such as "rtt", "rttNormalized", "seenTimes", "seenBy",
 *   and "lastSeen") it computes the value on the fly.
 */
export class RelayCheckAggregate {
  /**
   * (Optional) A normalization context provided by the aggregator.
   * It is used to compute the normalized RTT value.
   */
  public normalizationContext?: NormalizationContext;

  /**
   * @param checks A live reference to an array of Nip66CheckEvents for a relay.
   */
  constructor(public readonly checks: Nip66CheckEvent[]) {}

  /**
   * Returns the merged value for a given key.
   *
   * The merging rules are:
   * - **seenTimes**: returns the number of checks.
   * - **rtt**: returns the average RTT (if any).
   * - **rttNormalized**: returns the normalized RTT (using the normalizationContext, if set).
   * - **seenBy**: returns an array of monitor public keys (collected from each event).
   * - **lastSeen**: returns the latest created_at value.
   * - For any other key: iterates (from the most recent to oldest) and returns the first non-null value.
   *
   * @param key The key for which to retrieve the merged value.
   */
  public getValue(key: string): any {
    switch (key) {
      case "seenTimes": {
        // Return the count of events.
        return this.checks.length;
      }
      case "rtt": {
        // Compute the average rtt from all events that have a valid numeric rtt.
        const rtts = this.checks
          .map((check) => check.rtt)
          .filter((r): r is number => typeof r === "number");
        return rtts.length > 0 ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;
      }
      case "rttNormalized": {
        const avg = this.getValue("rtt");
        if (avg === null || !this.normalizationContext) return null;
        const { globalMin, range } = this.normalizationContext;
        return Math.round(((avg - globalMin) / range) * 10000) / 10000;
      }
      case "seenBy": {
        // Collect the monitorPubkey from each check.
        return this.checks.reduce<string[]>((acc, check) => {
          if (check.monitorPubkey !== null && check.monitorPubkey !== undefined) {
            acc.push(check.monitorPubkey);
          }
          return acc;
        }, []);
      }
      case "lastSeen": {
        // Return the highest (latest) created_at value.
        let latest: number | null = null;
        for (const check of this.checks) {
          const created = check.created_at;
          if (created !== null && created !== undefined && (latest === null || created > latest)) {
            latest = created;
          }
        }
        return latest;
      }
      default: {
        // For any other key, return the first non-null value found in the events.
        // The Nip66CheckEvent model already provides getters for its keys, so we assume
        // that each check has up-to-date values.
        for (let i = this.checks.length - 1; i >= 0; i--) {
          const value = this.checks[i][key as keyof Nip66CheckEvent];
          if (value !== null && value !== undefined) {
            return value;
          }
        }
        return null;
      }
    }
  }

  /**
   * Returns an aggregate object containing merged values for a set of keys.
   *
   * The keys include those defined in the Nip66CheckEvent.keys static property
   * (which come directly from your event model) plus some additional custom keys.
   */
  public get aggregate(): { [key: string]: any } {
    // Combine the keys from your imported Nip66CheckEvent and our custom ones.
    const keys = [
      ...Nip66CheckEvent.keys,
      "seenTimes",
      "rtt",
      "rttNormalized",
      "seenBy",
      "lastSeen",
    ];
    const result: { [key: string]: any } = {};
    for (const key of keys) {
      result[key] = this.getValue(key);
    }
    return result;
  }
}

/**
 * The RelayCheckAggregator groups an array of Nip66CheckEvents by relay.
 *
 * It creates a RelayCheckAggregate for each normalized relay URL (using the
 * value provided by Nip66CheckEvent.relay) and computes a global normalization
 * context for RTT values.
 */
export class RelayCheckAggregator {
  private _aggregates: Record<string, RelayCheckAggregate> = {};

  /**
   * @param checks An array of Nip66CheckEvents.
   */
  constructor(checks: Nip66CheckEvent[]) {
    this.groupChecks(checks);
    this.updateNormalizationContext();
  }

  /**
   * Groups an array of checks by normalized relay and adds them to the aggregates.
   *
   * @param checks An array of Nip66CheckEvents.
   */
  private groupChecks(checks: Nip66CheckEvent[]): void {
    for (const check of checks) {
      this.addCheck(check, /* updateNormalization */ false);
    }
  }

  /**
   * Adds a single Nip66CheckEvent to the aggregator.
   *
   * The check is filtered and normalized in the same way as in the constructor.
   * After adding the check, the global normalization context is recomputed.
   *
   * @param check The Nip66CheckEvent to add.
   * @param updateNormalization Whether to update the normalization context after adding this check.
   *                             Defaults to true.
   */
  public addCheck(check: Nip66CheckEvent, updateNormalization: boolean = true): void {
    // Skip checks without a relay.
    const relayValue = check.relay;
    if (!relayValue) return;

    // Exclude events with a tag that starts with '30166:' on an 'a' tag.
    if (check.tags.find((tag) => tag[0] === "a" && tag[1]?.startsWith("30166:"))) {
      return;
    }

    let normalizedRelay: string;
    try {
      normalizedRelay = new URL(relayValue).toString();
    } catch (e) {
      console.warn("Could not normalize relay:", relayValue);
      return;
    }

    // If the group exists, add to it; otherwise, create a new group.
    if (!this._aggregates[normalizedRelay]) {
      this._aggregates[normalizedRelay] = new RelayCheckAggregate([]);
    }
    this._aggregates[normalizedRelay].checks.push(check);

    // Update the normalization context if needed.
    if (updateNormalization) {
      this.updateNormalizationContext();
    }
  }

  /**
   * Recomputes the global normalization context for RTT values and updates all aggregates.
   */
  private updateNormalizationContext(): void {
    const avgRtts: number[] = [];
    for (const relay in this._aggregates) {
      const agg = this._aggregates[relay];
      const avg = agg.getValue("rtt");
      if (avg !== null) {
        avgRtts.push(avg);
      }
    }
    const globalMin = avgRtts.length > 0 ? Math.min(...avgRtts) : 0;
    const globalMax = avgRtts.length > 0 ? Math.max(...avgRtts) : 0;
    const range = globalMax - globalMin || 1;
    const normalizationContext: NormalizationContext = { globalMin, range };

    // Attach the normalization context to each aggregate.
    for (const relay in this._aggregates) {
      this._aggregates[relay].normalizationContext = normalizationContext;
    }
  }

  /**
   * Returns an object containing the RelayCheckAggregate instances keyed by normalized relay URL.
   */
  public getAggregates(): Record<string, RelayCheckAggregate> {
    return this._aggregates;
  }
}
