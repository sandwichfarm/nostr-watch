/**
 * Regression test for the spurious open-check warning:
 *   "Ignoring open check because the promise was already fulfilled when
 *    finish() was called"
 *
 * Root cause: on a connect failure, websocket_hard_fail() resolved the check
 * deferred DIRECTLY (promise.resolve), bypassing DeferredWrapper.resolve()
 * which is what clears the pending timeout. The timeout therefore survived,
 * fired later, and called finish() a second time on the already-settled check
 * — emitting the warning on every offline relay.
 *
 * The fix clears the pending timeout in websocket_hard_fail() before resolving
 * the deferred directly. This test exercises the exact TimeoutHelper.clear()
 * mechanism that fix relies on: a pending timeout callback (the would-be
 * second finish) must NOT fire once the timeout is cleared.
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
