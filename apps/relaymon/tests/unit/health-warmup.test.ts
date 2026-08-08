import { assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { checkCheckLoop } from "../../src/health/checks.ts";
import type {
  HealthThresholds,
  HeartbeatTracker,
} from "../../src/health/types.ts";

const thresholds: HealthThresholds = {
  checkIdleMs: 300000, // 5 minutes
  publishBacklogMax: 1000,
  errorRatePerMin: 100,
  startupGraceMs: 30000,
};

// Past the startup grace period for all cases below.
const startupTime = Date.now() - 10 * 60 * 1000;

Deno.test("checkCheckLoop: NOT in warmup, stale heartbeat + expired backlog -> fail (DOWN)", () => {
  const heartbeat: HeartbeatTracker = {
    startupTime,
    checkLoop: Date.now() - 10 * 60 * 1000, // stale (10m > 5m)
  };
  const result = checkCheckLoop(heartbeat, thresholds, 1247, false);
  assertEquals(result.status, "fail");
});

Deno.test("checkCheckLoop: warmup with stale heartbeat + expired backlog -> NOT fail (warn at worst)", () => {
  const heartbeat: HeartbeatTracker = {
    startupTime,
    checkLoop: Date.now() - 10 * 60 * 1000, // stale
  };
  const result = checkCheckLoop(heartbeat, thresholds, 1247, true);
  // Warmup must never hard-fail/DOWN on the expected backlog.
  assertEquals(result.status, "warn");
});

Deno.test("checkCheckLoop: warmup with fresh heartbeat + expired backlog -> pass (UP)", () => {
  const heartbeat: HeartbeatTracker = {
    startupTime,
    checkLoop: Date.now() - 1000, // fresh
  };
  const result = checkCheckLoop(heartbeat, thresholds, 1247, true);
  assertEquals(result.status, "pass");
  assertEquals(result.message, "Warmup in progress");
});

Deno.test("checkCheckLoop: warmup just started (no heartbeat yet) -> pass (UP)", () => {
  const heartbeat: HeartbeatTracker = { startupTime };
  const result = checkCheckLoop(heartbeat, thresholds, 1247, true);
  assertEquals(result.status, "pass");
});
