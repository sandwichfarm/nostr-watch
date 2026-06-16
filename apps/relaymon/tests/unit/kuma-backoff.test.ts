/**
 * M3 — KumaPusher heartbeat backoff resilience.
 *
 * Production evidence: the monitor computed health=up but its push to the
 * Uptime-Kuma endpoint flapped with TCP "Connection refused" (container IPv6
 * routing). The legacy backoff `Math.min(2^failures, 16)` let the wait between
 * heartbeats grow to 16× the interval (~32 min at intervalMs=2m), reset only
 * on a successful push — so a transient blip kept the monitor reported DOWN on
 * status.nostr.watch long after connectivity recovered.
 *
 * A heartbeat must keep firing near its configured interval. The wait between
 * attempts must stay bounded by a small multiple of intervalMs regardless of
 * how many consecutive failures have accrued.
 */

import { assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { KumaPusher } from "../../src/health/kuma.ts";
import type { KumaConfig } from "../../src/health/types.ts";

function makePusher(cfg: Partial<KumaConfig> = {}) {
  const config: KumaConfig = {
    enabled: true,
    intervalMs: 120_000, // 2m, matching fisherman
    degradedAsUp: false,
    startupGraceMs: 60_000,
    msgVerbosity: "detailed",
    ...cfg,
  };
  // calculateWaitTime only reads this.config and this.failureCount.
  const ctx = {} as any;
  return new KumaPusher(config, ctx, "https://example.test/api/push/token");
}

function waitTimeAt(pusher: KumaPusher, failureCount: number): number {
  (pusher as any).failureCount = failureCount;
  return (pusher as any).calculateWaitTime() as number;
}

Deno.test("kuma backoff: wait stays bounded at a small multiple of interval under sustained failures", () => {
  const pusher = makePusher();
  const interval = 120_000;

  // Even after many consecutive failures, the heartbeat wait must not balloon.
  // Ceiling: default cap (<=4x) plus the +10% jitter margin. The legacy 16x
  // (=1.92M ms) must NOT be reachable.
  const ceiling = interval * 4 * 1.1;
  for (const failures of [1, 3, 5, 10, 20]) {
    const w = waitTimeAt(pusher, failures);
    assert(
      w <= ceiling,
      `wait at ${failures} failures was ${w}ms, exceeds heartbeat ceiling ${ceiling}ms (legacy 16x bug)`,
    );
  }

  // And it must be well under the legacy 16x worst case.
  assert(
    waitTimeAt(pusher, 20) < interval * 16,
    "wait must be far below the legacy 16x maximum",
  );
});

Deno.test("kuma backoff: never waits less than the configured floor", () => {
  const pusher = makePusher();
  // With zero failures the wait is ~interval (with jitter), always >= 1s floor.
  const w = waitTimeAt(pusher, 0);
  assert(w >= 1000, `wait floor must be >= 1s, got ${w}`);
});

Deno.test("kuma backoff: maxBackoffMultiplier is configurable", () => {
  const pusher = makePusher({ maxBackoffMultiplier: 1 } as Partial<KumaConfig>);
  const interval = 120_000;
  // multiplier capped at 1 => wait ~= interval (+/- jitter), never grows.
  assert(
    waitTimeAt(pusher, 50) <= interval * 1.1,
    "with maxBackoffMultiplier=1 the wait must stay at ~interval",
  );
});
