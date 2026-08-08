/**
 * websocket_hard_fail() must clear a check's pending timeout when it resolves
 * the deferred directly, or the timeout fires later and finish()es an
 * already-settled check (the spurious "already fulfilled" warning). Covers the
 * TimeoutHelper.clear() mechanism the fix relies on.
 *
 * Run: deno test --no-check libraries/nocap/src/classes/timeout-lifecycle.deno.test.ts
 */

import { assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { TimeoutHelper } from "./TimeoutHelper.ts";

const session = { get: () => "test-session", url: "wss://t.example" };

Deno.test("pending check timeout fires its callback when NOT cleared (reproduces the second finish)", async () => {
  const t = new TimeoutHelper(session);
  let secondFinishFired = false;
  // Simulates the open-check timeout whose callback would call finish('open').
  t.create("open", 15, () => {
    secondFinishFired = true;
  });
  await new Promise((r) => setTimeout(r, 50));
  assert(
    secondFinishFired,
    "control: an uncleared timeout fires the would-be second finish('open')",
  );
});

Deno.test("clearing the timeout on hard-fail prevents the redundant finish('open')", async () => {
  const t = new TimeoutHelper(session);
  let secondFinishFired = false;
  t.create("open", 15, () => {
    secondFinishFired = true;
  });

  // websocket_hard_fail() now clears the pending timeout for the current check
  // before resolving its deferred directly:
  assert(t.has("open"), "timeout should be registered before clear");
  t.clear("open");

  await new Promise((r) => setTimeout(r, 50));
  assert(
    !secondFinishFired,
    "after clear, the timeout must NOT fire — no redundant finish('open'), no spurious warning",
  );
});
