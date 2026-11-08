import type { Event as SignedEvent } from "nostr-tools";
import { deepStrictEqual, ok, rejects, strictEqual, throws } from "node:assert";
import { Publisher } from "../../../../internal/publisher/src/Publisher.ts";
import {
  db,
  initializeDB,
  isDeletionPublished,
  storeRelayInfo,
} from "../../src/db/db.ts";
import {
  deleteRelayCheckEvent,
  setDeletionPublishSuppressed,
} from "../../src/utils/deletion.ts";
import { maybeAnnounce } from "../../src/utils/announce.ts";
import {
  createInfoHash,
  reevaluateAllDeduplication,
  relayHostnameDedup,
  relayListHostnameDedup,
  setConfig,
} from "../../src/utils/hostnames.ts";
import {
  drainRemediationDeletionQueue,
  rerunDedupForAllRowsMigration,
} from "../../src/utils/remediation.ts";
import { rules } from "../../src/utils/dedup-overrides/index.ts";
import { IgnoreListSync } from "../../src/utils/IgnoreListSync.ts";
import { Worker } from "../../src/core/worker.ts";
import { runDaemon } from "../../src/core/daemon.ts";
import type { PublicationContext } from "../../src/utils/publishTransport.ts";
import type { QueueManager } from "../../src/utils/queueManager.ts";
import type { Config } from "../../src/types/config.ts";
import type { RelayCheckResult } from "../../src/types/relay.ts";
import { mockConfig } from "../helpers/fixtures.ts";

const key = "1".padStart(64, "0");
const target = "wss://publish.invalid";
const config = (): Config => ({
  ...structuredClone(mockConfig),
  publisher: {
    relays: [target],
    retry: { maxRetries: 0, initialBackoffMs: 1 },
    transport: { mode: "per-relay-process" },
  },
  monitor: { info: { name: "fixture" } },
  announce: { userMetaRelays: ["wss://metadata.invalid"] },
} as Config);
function context(
  onPublish: (event: SignedEvent, relay: string) => Promise<unknown> = () =>
    Promise.resolve("ACK"),
) {
  const events: Array<{ event: SignedEvent; relay: string }> = [];
  const stops: Array<() => void> = [];
  let leases = 0;
  const ctx = {
    stopping: false,
    onStop: (f: () => void) => stops.push(f),
    onDrain: () => {},
    publisherFactory: (key: string, relays: string[]) => {
      leases++;
      return new Publisher(key, relays, {
        transport: {
          publish: (relay, event) => {
            events.push({ event, relay });
            return onPublish(event, relay);
          },
          release: () => {
            leases--;
          },
        },
      });
    },
  };
  return {
    ctx: ctx as unknown as PublicationContext,
    state: ctx,
    events,
    stops,
    leases: () => leases,
  };
}
function seed(url: string, online = 1) {
  db.query(
    "INSERT OR REPLACE INTO relay_status (url, checked_at, network, ignore, online, retries) VALUES (?, 0, 'clearnet', 1, ?, 0)",
    [url, online],
  );
}
function reset() {
  db.query("DELETE FROM relay_status");
  db.query("DELETE FROM relay_info");
  db.query("DELETE FROM remediation_deletion_queue");
}
initializeDB(":memory:", false);
setDeletionPublishSuppressed(false);

Deno.test("every opt-in wrapper rejects missing context before signing, dispatch or cold DB mutation", async () => {
  const c = config();
  setConfig(c);
  await rejects(
    deleteRelayCheckEvent("wss://guard.invalid", "test", c),
    /runtime context/,
  );
  await rejects(maybeAnnounce(c), /runtime context/);
  throws(() => new IgnoreListSync(c, []), /runtime context/);
  throws(() => new Worker("fixture", {} as QueueManager, c), /runtime context/);
  await rejects(runDaemon(c), /runtime context/);
  throws(() => drainRemediationDeletionQueue(c), /runtime context/);
  await rejects(rerunDedupForAllRowsMigration(), /runtime context/);
  await rejects(relayHostnameDedup({} as RelayCheckResult), /runtime context/);
  await rejects(relayListHostnameDedup([]), /runtime context/);
  await rejects(reevaluateAllDeduplication(), /runtime context/);
  setConfig(mockConfig as Config);
});

for (const queued of [false, true]) {
  Deno.test(`kind5 ${queued ? "queued" : "direct"} markers require injected ACK and failure remains eligible`, async () => {
    reset();
    const c = config();
    const url = `wss://deletion-${queued}.invalid/`;
    seed(url);
    Deno.env.set("RELAYMON_NSEC", key);
    let success = false;
    const fake = context(() =>
      success
        ? Promise.resolve("ACK")
        : Promise.reject(new Error("negative ACK"))
    );
    const jobs: Array<() => Promise<void>> = [];
    const queue = queued
      ? {
        addPublishJob: (job: () => Promise<void>) => jobs.push(job),
      } as unknown as QueueManager
      : undefined;
    try {
      const first = await deleteRelayCheckEvent(
        url,
        "fixture",
        c,
        queue,
        fake.ctx,
      );
      if (queued) {
        strictEqual(first, true);
        await rejects(jobs.shift()!());
      } else strictEqual(first, false);
      strictEqual(isDeletionPublished(url), false);
      success = true;
      await deleteRelayCheckEvent(url, "fixture", c, queue, fake.ctx);
      if (queued) await jobs.shift()!();
      strictEqual(isDeletionPublished(url), true);
      strictEqual(fake.events.length, 2);
      strictEqual(fake.leases(), 0);
      ok(fake.events.every(({ event }) => event.kind === 5 && event.sig));
    } finally {
      Deno.env.delete("RELAYMON_NSEC");
    }
  });
}

Deno.test("cold remediation drains use the factory and stop between durable rows", async () => {
  reset();
  Deno.env.set("RELAYMON_NSEC", key);
  const c = config();
  for (
    const url of ["wss://cold-first.invalid/", "wss://cold-second.invalid/"]
  ) {
    seed(url);
    db.query(
      "INSERT INTO remediation_deletion_queue (url, reason, queued_at, attempts) VALUES (?, 'fixture', 0, 0)",
      [url],
    );
  }
  const fake = context(() => {
    fake.state.stopping = true;
    return Promise.resolve("ACK");
  });
  try {
    await drainRemediationDeletionQueue(c, fake.ctx);
    strictEqual(isDeletionPublished("wss://cold-first.invalid/"), true);
    strictEqual(isDeletionPublished("wss://cold-second.invalid/"), false);
    deepStrictEqual(
      db.query("SELECT url, attempts FROM remediation_deletion_queue"),
      [["wss://cold-second.invalid/", 0]],
    );
    strictEqual(fake.events.length, 1);
    strictEqual(fake.leases(), 0);
  } finally {
    Deno.env.delete("RELAYMON_NSEC");
  }
});

for (
  const branch of [
    "override",
    "nip11-root",
    "nip11-shorter",
    "defensive",
    "general",
  ] as const
) {
  Deno.test(`dedup ${branch} deletion uses the injected factory and ACK marker`, async () => {
    reset();
    const c = config();
    setConfig(c);
    Deno.env.set("RELAYMON_NSEC", key);
    const fake = context();
    const host = `${branch}.invalid`;
    const url = `wss://${host}/long/path`;
    seed(url);
    const info = {
      name: `same-${branch}`,
      supported_nips: [1, 11],
      software: "fixture",
    };
    const result = {
      url,
      hostname: host,
      protocol: "wss:",
      online: true,
      ignore: false,
      info: { data: {} },
    } as RelayCheckResult;
    let onlineUrls: string[] = [];
    if (branch === "override") {
      rules.unshift({
        name: "fixture-deny",
        action: "deny",
        reason: "fixture override",
        test: (u) => u.hostname === host,
      });
    } else {
      const sibling = branch === "nip11-shorter"
        ? `wss://${host}/a`
        : `wss://${host}/`;
      seed(sibling, branch === "defensive" ? 0 : 1);
      if (branch.startsWith("nip11")) {
        storeRelayInfo(sibling, info, createInfoHash(info));
        result.info = { data: info } as RelayCheckResult["info"];
      }
      if (branch === "general") {
        result.url = `wss://${host}/${"a".repeat(64)}`;
        seed(result.url);
      }
      onlineUrls = branch === "defensive" ? [] : [sibling];
    }
    try {
      const value = await relayHostnameDedup(result, {
        onlineUrls,
        publication: fake.ctx,
      });
      strictEqual(value.ignore, true);
      strictEqual(fake.events.length, 1);
      strictEqual(fake.events[0].event.kind, 5);
      strictEqual(isDeletionPublished(result.url), true);
      strictEqual(fake.leases(), 0);
    } finally {
      if (branch === "override") rules.shift();
      setConfig(mockConfig as Config);
      Deno.env.delete("RELAYMON_NSEC");
    }
  });
}

Deno.test("enabled opt-in kind10006 keeps dirty state on all-fail and clears only after ACK", async () => {
  reset();
  const c = config();
  c.relaymon.ignorelist = {
    enabled: true,
    relays: [target],
    pubkeys: [],
    interval: "24h",
    deletion_interval: "24h",
  };
  let succeed = false;
  const fake = context(() =>
    succeed ? Promise.resolve("ACK") : Promise.reject(new Error("negative ACK"))
  );
  const sync = new IgnoreListSync(c, [], fake.ctx);
  sync.addToIgnoreList("wss://ignored.invalid/", "fixture");
  await rejects(sync.publish(key), /All promises/);
  strictEqual(
    (sync as unknown as { localIgnoreListChanged: boolean })
      .localIgnoreListChanged,
    true,
  );
  succeed = true;
  await sync.publish(key);
  strictEqual(
    (sync as unknown as { localIgnoreListChanged: boolean })
      .localIgnoreListChanged,
    false,
  );
  deepStrictEqual(fake.events.map(({ event }) => event.kind), [10006, 10006]);
  strictEqual(fake.leases(), 0);
  sync.close();
  c.relaymon.ignorelist.enabled = false;
  const disabled = new IgnoreListSync(c, [], fake.ctx);
  disabled.addToIgnoreList("wss://another.invalid/");
  await disabled.publish(key);
  strictEqual(fake.events.length, 2);
  disabled.close();
});

Deno.test("announcement real wrapper uses injected monitor/metadata destinations for every required kind", async () => {
  Deno.env.set("RELAYMON_NSEC", key);
  const c = config();
  const fake = context();
  try {
    await maybeAnnounce(c, undefined, fake.ctx);
    const routes = fake.events.map(({ event, relay }) => [event.kind, relay]);
    ok(
      routes.some(([kind, r]) =>
        kind === 10166 && r === "wss://publish.invalid/"
      ),
    );
    ok(
      routes.some(([kind, r]) =>
        kind === 10166 && r === "wss://metadata.invalid/"
      ),
    );
    ok(
      routes.some(([kind, r]) => kind === 0 && r === "wss://metadata.invalid/"),
    );
    ok(
      routes.some(([kind, r]) =>
        kind === 10002 && r === "wss://metadata.invalid/"
      ),
    );
    strictEqual(fake.leases(), 0);
  } finally {
    Deno.env.delete("RELAYMON_NSEC");
  }
});

Deno.test("worker normal and TRA publishers share the injected boundary and stop retry/TRA admission", async () => {
  const { getPublicKey } = await import("nostr-tools");
  reset();
  Deno.env.set("RELAYMON_NSEC", key);
  const c = config();
  c.publisher.retry = { maxRetries: 1, initialBackoffMs: 1 };
  c.relaymon.trustedRelayAssertions = {
    enabled: true,
    relays: ["wss://tra.invalid"],
    min_observations: 1,
    material_change_threshold: 3,
    publish_unreachable: true,
  };
  const fake = context(() => Promise.reject(new Error("negative ACK")));
  const jobs: Array<() => Promise<void>> = [];
  const queue = {
    addPublishJob: (job: () => Promise<void>) => jobs.push(job),
  } as unknown as QueueManager;
  const worker = new Worker(
    getPublicKey(new Uint8Array(32).fill(0).map((_, i) => i === 31 ? 1 : 0)),
    queue,
    c,
    undefined,
    fake.ctx,
  );
  const result = {
    url: "wss://observed.invalid/",
    hostname: "observed.invalid",
    protocol: "wss:",
    network: "clearnet",
    checked_at: 1,
    online: true,
    ignore: false,
    parent: "",
    open: { data: true, duration: 1 },
    read: { data: true, duration: 1 },
    info: { data: { supported_nips: [1, 11] } },
  } as RelayCheckResult;
  try {
    worker.publishResult(result);
    await rejects(jobs.shift()!());
    await worker.publishTrustedRelayAssertion(result);
    await rejects(jobs.shift()!());
    strictEqual(fake.events[0].event.kind, 30166);
    strictEqual(fake.events[0].relay, "wss://publish.invalid/");
    strictEqual(fake.events[1].event.kind, 30385);
    strictEqual(fake.events[1].relay, "wss://tra.invalid/");
    fake.state.stopping = true;
    for (const stop of fake.stops) stop();
    worker.enqueueTrustedRelayObservation(result);
    await worker.drainPublicationWork();
    await new Promise((resolve) => setTimeout(resolve, 5));
    strictEqual(jobs.length, 0);
    strictEqual(
      (worker as unknown as { traQueue: unknown[] }).traQueue.length,
      0,
    );
  } finally {
    for (const stop of fake.stops) stop();
    await worker.closePublishers();
    Deno.env.delete("RELAYMON_NSEC");
    setConfig(mockConfig as Config);
  }
});
