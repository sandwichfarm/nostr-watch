import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import { Publisher } from "../../../../internal/publisher/src/Publisher.ts";
import { runDaemon } from "../../src/core/daemon.ts";
import { Worker } from "../../src/core/worker.ts";
import {
  db,
  initializeDB,
  isDeletionPublished,
  markDeletionPublished,
} from "../../src/db/db.ts";
import { setDeletionPublishSuppressed } from "../../src/utils/deletion.ts";
import { drainRemediationDeletionQueue } from "../../src/utils/remediation.ts";
import { IgnoreListSync } from "../../src/utils/IgnoreListSync.ts";
import type { Config } from "../../src/types/config.ts";

const config = {
  queue: { workerConcurrency: 1 },
  publisher: { relays: ["wss://publisher.invalid"] },
  relaymon: {
    networks: ["clearnet"],
    checks: {
      enabled: ["open"],
      options: { max: 2, expires: 1000, interval: 60000, statusInterval: 600 },
    },
    retry: { expiry: [{ max: 10, delay: 1000 }] },
  },
} as Config;

function seed(url: string) {
  db.query("DELETE FROM relay_status");
  db.query("DELETE FROM remediation_deletion_queue");
  db.query(
    `INSERT INTO relay_status (url, checked_at, network, ignore, online, retries)
     VALUES (?, 0, 'clearnet', 1, 0, 0)`,
    [url],
  );
  db.query(
    `INSERT INTO remediation_deletion_queue (url, reason, queued_at, attempts)
     VALUES (?, 'synthetic remediation', 0, 0)`,
    [url],
  );
}

function pending() {
  return db.query("SELECT attempts FROM remediation_deletion_queue");
}

// A subprocess owns the daemon's persistent loops, matching its current
// process-exit shutdown contract without leaking timers into other tests.
async function startupFixture() {
  initializeDB(":memory:", false);
  seed("wss://ignored.invalid/");
  db.query(
    `INSERT INTO relay_status (url, checked_at, network, ignore, online, retries)
     VALUES ('wss://check.invalid/', 0, 'clearnet', 0, 1, 0)`,
  );
  db.query(
    "UPDATE relay_status SET ignore_reason = 'does not speak nostr protocol' WHERE ignore = 1",
  );
  const deletionStarted = Promise.withResolvers<void>();
  const checkStarted = Promise.withResolvers<void>();
  const ack = Promise.withResolvers<string>();
  let deletionAttempts = 0;
  const checkedUrls: string[] = [];
  let syncCalls = 0;
  let deletionCalls = 0;
  let reevaluationCalls = 0;
  const scheduledSync = Promise.withResolvers<void>();
  const scheduledDeletions = Promise.withResolvers<void>();
  const scheduledReevaluation = Promise.withResolvers<void>();
  IgnoreListSync.prototype.sync = () => {
    if (++syncCalls > 1) scheduledSync.resolve();
    return Promise.resolve();
  };
  IgnoreListSync.prototype.publish = () => Promise.resolve();
  IgnoreListSync.prototype.publishDeletions = () => {
    if (++deletionCalls > 1) scheduledDeletions.resolve();
    return Promise.resolve();
  };
  Worker.prototype.recheckIgnoredRelay = () => {
    reevaluationCalls++;
    scheduledReevaluation.resolve();
    return Promise.resolve(false);
  };
  Publisher.prototype.publishEvent = () => {
    deletionAttempts++;
    deletionStarted.resolve();
    return ack.promise;
  };
  Publisher.prototype.close = () => Promise.resolve();
  Worker.prototype.processRelay = (url) => {
    checkedUrls.push(url);
    if (url === "wss://check.invalid/") checkStarted.resolve();
    return Promise.resolve();
  };
  Deno.env.set("RELAYMON_NSEC", "1".padStart(64, "0"));
  const failure = Promise.withResolvers<never>();
  const ignorelist = {
    enabled: true,
    interval: "0s",
    deletion_interval: "0s",
    reevaluation_interval: "0s",
    relays: [],
    pubkeys: [],
  };
  runDaemon({
    ...config,
    relaymon: {
      ...config.relaymon,
      ignorelist,
    },
  }).catch(failure.reject);
  const timer = setTimeout(
    () =>
      failure.reject(
        new Error("check startup blocked by pending deletion ACK"),
      ),
    5000,
  );
  try {
    await Promise.race([
      Promise.all([deletionStarted.promise, checkStarted.promise]),
      failure.promise,
    ]);
    assert(checkedUrls.length > 0);
    assert(
      checkedUrls.every((url) => url === "wss://check.invalid/"),
      "pending remediation owns its ignored URL during kickoff",
    );
    assertEquals(deletionAttempts, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assertEquals(
      [syncCalls, deletionCalls, reevaluationCalls],
      [1, 1, 0],
      "scheduled ignore mutations wait for the startup drain",
    );
    assertEquals(
      pending(),
      [[0]],
      "unacknowledged deletion stays durable while checks run",
    );
    const drain = drainRemediationDeletionQueue(config);
    ack.resolve("accepted");
    await drain;
    assertEquals(pending(), []);
    assertEquals(deletionAttempts, 1);
    await Promise.race([
      Promise.all([
        scheduledSync.promise,
        scheduledDeletions.promise,
        scheduledReevaluation.promise,
      ]),
      failure.promise,
    ]);
    console.log("checks started before deletion ACK");
  } finally {
    clearTimeout(timer);
  }
}

if (import.meta.main) {
  try {
    await startupFixture();
    Deno.exit(0);
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
} else {
  initializeDB(":memory:", false);

  Deno.test("daemon starts checks while remediation deletion ACK is blocked", async () => {
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--no-lock",
        "--no-check",
        "--unstable-sloppy-imports",
        "-A",
        "--deny-net",
        new URL(import.meta.url).pathname,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const output = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    assertEquals(result.code, 0, output);
    assert(output.includes("checks started before deletion ACK"));
  });

  Deno.test("overlapping remediation drains share one ACK attempt", async () => {
    const url = "wss://single-flight.invalid/";
    seed(url);
    setDeletionPublishSuppressed(false);
    const key = Deno.env.get("RELAYMON_NSEC");
    Deno.env.set("RELAYMON_NSEC", "1".padStart(64, "0"));
    const publish = Publisher.prototype.publishEvent;
    const close = Publisher.prototype.close;
    const ack = Promise.withResolvers<string>();
    const started = Promise.withResolvers<void>();
    let attempts = 0;
    let closes = 0;
    Publisher.prototype.publishEvent = () => {
      attempts++;
      started.resolve();
      return ack.promise;
    };
    Publisher.prototype.close = () => {
      closes++;
      return Promise.resolve();
    };
    const first = drainRemediationDeletionQueue(config);
    const overlapping = drainRemediationDeletionQueue(config);
    try {
      await started.promise;
      assertStrictEquals(first, overlapping);
      assertEquals(attempts, 1);
      assertEquals(pending(), [[0]]);
      assertEquals(isDeletionPublished(url), false);
      ack.resolve("accepted");
      await Promise.all([first, overlapping]);
      assertEquals(pending(), []);
      assertEquals(closes, 1);
      assertEquals(isDeletionPublished(url), true);
    } finally {
      ack.resolve("accepted");
      await Promise.all([first, overlapping]);
      Publisher.prototype.publishEvent = publish;
      Publisher.prototype.close = close;
      if (key === undefined) Deno.env.delete("RELAYMON_NSEC");
      else Deno.env.set("RELAYMON_NSEC", key);
    }
  });

  Deno.test("rejected deletion stays queued and a later drain can retry", async () => {
    const url = "wss://retry-drain.invalid/";
    seed(url);
    setDeletionPublishSuppressed(false);
    const key = Deno.env.get("RELAYMON_NSEC");
    Deno.env.set("RELAYMON_NSEC", "1".padStart(64, "0"));
    const publish = Publisher.prototype.publishEvent;
    const close = Publisher.prototype.close;
    const log = console.error;
    const errors: string[] = [];
    let closes = 0;
    console.error = (...args) => errors.push(args.join(" "));
    Publisher.prototype.publishEvent = () =>
      Promise.reject(new Error("synthetic rejected ACK"));
    Publisher.prototype.close = () => {
      closes++;
      return Promise.resolve();
    };
    try {
      await drainRemediationDeletionQueue(config);
      assertEquals(pending(), [[1]]);
      assertEquals(isDeletionPublished(url), false);
      assert(errors.some((line) => line.includes("synthetic rejected ACK")));
      Publisher.prototype.publishEvent = () => Promise.resolve("accepted");
      await drainRemediationDeletionQueue(config);
      assertEquals(pending(), []);
      assertEquals(isDeletionPublished(url), true);
      assertEquals(closes, 2);
    } finally {
      Publisher.prototype.publishEvent = publish;
      Publisher.prototype.close = close;
      console.error = log;
      if (key === undefined) Deno.env.delete("RELAYMON_NSEC");
      else Deno.env.set("RELAYMON_NSEC", key);
    }
  });

  Deno.test("failed drain logs its error and releases the single-flight guard", async () => {
    const query = db.query;
    const log = console.error;
    const errors: string[] = [];
    let reads = 0;
    console.error = (...args) => errors.push(args.join(" "));
    db.query = () => {
      reads++;
      throw new Error("synthetic queue read failure");
    };
    try {
      await drainRemediationDeletionQueue(config);
      await drainRemediationDeletionQueue(config);
      assertEquals(
        reads,
        2,
        "a failed pass cannot permanently block a later drain",
      );
      assertEquals(
        errors.filter((line) =>
          line.includes("drainRemediationDeletionQueue failed:") &&
          line.includes("synthetic queue read failure")
        ).length,
        2,
      );
    } finally {
      db.query = query;
      console.error = log;
    }
  });

  Deno.test("durably acknowledged remediation rows are removed without republishing", async () => {
    const url = "wss://durable-ack.invalid/";
    seed(url);
    markDeletionPublished(url);
    const publish = Publisher.prototype.publishEvent;
    let attempts = 0;
    Publisher.prototype.publishEvent = () => {
      attempts++;
      return Promise.reject(new Error("must not republish a durable ACK"));
    };
    try {
      await drainRemediationDeletionQueue(config);
      assertEquals(pending(), []);
      assertEquals(attempts, 0);
      assertEquals(isDeletionPublished(url), true);
    } finally {
      Publisher.prototype.publishEvent = publish;
    }
  });
}
