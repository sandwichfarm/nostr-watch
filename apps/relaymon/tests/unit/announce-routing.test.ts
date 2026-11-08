import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert";
import { Publisher } from "../../../../internal/publisher/src/Publisher.ts";
import { AnnounceMonitor } from "../../../../internal/announce/src/index.ts";
import { maybeAnnounce } from "../../src/utils/announce.ts";
import type { Config } from "../../src/types/config.ts";
import { QueueManager } from "../../src/utils/queueManager.ts";
import {
  buildHealthSnapshot,
  ErrorTracker,
} from "../../src/health/snapshot.ts";

const outboxRelays = ["ws://owned-outbox.invalid"];
const metadataRelays = ["ws://owned-metadata.invalid"];
const defaultMetadataRelays = ["wss://purplepag.es", "wss://user.kindpag.es"];

for (const queued of [false, true]) {
  for (const mode of ["configured", "empty", "omitted"] as const) {
    Deno.test(`announcement ${mode} metadata destinations (${queued ? "queued" : "direct"})`, async () => {
      const destinations = mode === "configured"
        ? metadataRelays
        : mode === "empty"
        ? []
        : undefined;
      const config = {
        monitor: {
          info: { name: "Routing regression", about: "Offline test" },
        },
        publisher: { relays: outboxRelays },
        announce: destinations === undefined
          ? {}
          : { userMetaRelays: destinations },
        relaymon: {
          networks: ["clearnet"],
          checks: {
            enabled: ["open", "read", "info"],
            options: { expires: 60_000, timeout: {} },
          },
        },
      } as unknown as Config;
      const calls: Array<{ kind: number; relays: string[] }> = [];
      const jobs: Array<() => Promise<void>> = [];
      const queue = queued
        ? {
          addPublishJob: (job: () => Promise<void>) => jobs.push(job),
        } as unknown as QueueManager
        : undefined;
      const originalPublish = Publisher.prototype.publishEvent;
      const originalKey = Deno.env.get("RELAYMON_NSEC");
      // Publicly known fixture key, scoped to this test process; never published.
      Deno.env.set("RELAYMON_NSEC", "01".repeat(32));
      Publisher.prototype.publishEvent = function (event) {
        ok(
          /^[0-9a-f]{64}$/.test(event.id),
          "real announcement generation/signing must run",
        );
        ok(/^[0-9a-f]{128}$/.test(event.sig));
        calls.push({ kind: event.kind, relays: [...this.relays] });
        return Promise.resolve();
      };
      try {
        await maybeAnnounce(config, queue);
        strictEqual(jobs.length, queued ? 1 : 0);
        for (const job of jobs) await job();
        strictEqual(calls.length, mode === "empty" ? 1 : 3);
        const expectedMetadata = destinations ?? defaultMetadataRelays;
        for (const kind of [0, 10002]) {
          if (mode === "empty") {
            strictEqual(calls.some((call) => call.kind === kind), false);
          } else {deepStrictEqual(
              calls.find((call) => call.kind === kind)?.relays,
              expectedMetadata,
            );}
        }
        deepStrictEqual(
          calls.find((call) => call.kind === 10166)?.relays,
          [...new Set([...outboxRelays, ...(destinations ?? [])])],
        );
      } finally {
        Publisher.prototype.publishEvent = originalPublish;
        if (originalKey === undefined) Deno.env.delete("RELAYMON_NSEC");
        else Deno.env.set("RELAYMON_NSEC", originalKey);
      }
    });
  }
}

const fixtureKey = "01".repeat(32);
type SignedAnnouncement = {
  id: string;
  sig: string;
  kind: number;
  created_at: number;
};
type RetryFixture = {
  calls: SignedAnnouncement[];
  jobs: Array<
    {
      job: () => Promise<void>;
      options: { isRetry?: boolean; category?: string };
    }
  >;
  timers: Array<{ callback: () => void; delay: number }>;
  infos: string[];
  queue: QueueManager;
  transport: (event: SignedAnnouncement) => Promise<unknown>;
};

function configForRetry(retry?: Config["publisher"]["retry"]): Config {
  return {
    monitor: { info: { name: "Recovery regression", about: "Offline test" } },
    publisher: { relays: outboxRelays, retry },
    announce: { userMetaRelays: metadataRelays },
    relaymon: {
      networks: ["clearnet"],
      checks: {
        enabled: ["open", "read", "info"],
        options: { expires: 60_000, timeout: {} },
      },
    },
  } as unknown as Config;
}

async function retryFixture(
  test: (state: RetryFixture) => Promise<void>,
): Promise<void> {
  const originalPublish = Publisher.prototype.publishEvent;
  const originalTimeout = globalThis.setTimeout;
  const originalInterval = globalThis.setInterval;
  const originalInfo = console.info;
  const originalKey = Deno.env.get("RELAYMON_NSEC");
  const state = {
    calls: [],
    jobs: [],
    timers: [],
    infos: [],
    transport: () => Promise.resolve("owned ACK"),
  } as unknown as RetryFixture;
  state.queue = {
    addPublishJob: (
      job: () => Promise<void>,
      options: { isRetry?: boolean; category?: string },
    ) => state.jobs.push({ job, options }),
  } as unknown as QueueManager;
  Deno.env.set("RELAYMON_NSEC", fixtureKey);
  Publisher.prototype.publishEvent = function (event: SignedAnnouncement) {
    ok(/^[0-9a-f]{64}$/.test(event.id));
    ok(/^[0-9a-f]{128}$/.test(event.sig));
    state.calls.push(event);
    return state.transport(event);
  };
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    state.timers.push({ callback, delay });
    return 0;
  }) as typeof globalThis.setTimeout;
  globalThis.setInterval =
    (() => 0) as unknown as typeof globalThis.setInterval;
  console.info = (...args: unknown[]) => {
    state.infos.push(args.join(" "));
    originalInfo(...args);
  };
  try {
    await test(state);
  } finally {
    Publisher.prototype.publishEvent = originalPublish;
    globalThis.setTimeout = originalTimeout;
    globalThis.setInterval = originalInterval;
    console.info = originalInfo;
    if (originalKey === undefined) Deno.env.delete("RELAYMON_NSEC");
    else Deno.env.set("RELAYMON_NSEC", originalKey);
  }
}

Deno.test("partial announcement failure rejects the job and retries only the same unacknowledged event", () =>
  retryFixture(async (state) => {
    state.transport = (event) =>
      event.kind === 0
        ? Promise.reject(new Error("first metadata ACK missing"))
        : Promise.resolve("owned ACK");
    await maybeAnnounce(configForRetry(), state.queue);
    await rejects(state.jobs[0].job, AggregateError);
    deepStrictEqual(state.calls.map((event) => event.kind), [0, 10002, 10166]);
    strictEqual(
      state.infos.some((line) =>
        line.includes("Monitor announcement published successfully")
      ),
      false,
    );
    strictEqual(state.timers.length, 1);
    strictEqual(state.timers[0].delay, 120_000);
    const failed = state.calls[0];
    state.transport = () => Promise.resolve("owned ACK");
    state.timers[0].callback();
    deepStrictEqual(state.jobs[1].options, {
      isRetry: true,
      category: "announce",
    });
    await state.jobs[1].job();
    deepStrictEqual(state.calls.map((event) => event.kind), [
      0,
      10002,
      10166,
      0,
    ]);
    strictEqual(
      state.calls[3],
      failed,
      "retry must preserve the signed object, signature, ID and timestamp",
    );
    strictEqual(
      state.infos.filter((line) =>
        line.includes("Monitor announcement published successfully via queue")
      ).length,
      1,
    );
  }));

Deno.test("announcement retries honor configured exhaustion without a success result", async () => {
  for (const maxRetries of [0, 2]) {
    await retryFixture(async (state) => {
      state.transport = (event) =>
        event.kind === 0
          ? Promise.reject(new Error("metadata ACK missing"))
          : Promise.resolve("owned ACK");
      await maybeAnnounce(
        configForRetry({ maxRetries, initialBackoffMs: 10 }),
        state.queue,
      );
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        await rejects(state.jobs[attempt].job, AggregateError);
        if (attempt < maxRetries) {
          strictEqual(state.timers[attempt].delay, 10 * 2 ** (attempt + 1));
          state.timers[attempt].callback();
        }
      }
      strictEqual(state.jobs.length, maxRetries + 1);
      strictEqual(state.timers.length, maxRetries);
      strictEqual(
        state.calls.filter((event) => event.kind === 10002).length,
        1,
      );
      strictEqual(
        state.calls.filter((event) => event.kind === 10166).length,
        1,
      );
      strictEqual(
        state.infos.some((line) =>
          line.includes("Monitor announcement published successfully")
        ),
        false,
      );
    });
  }
});

Deno.test("direct announcement failure rejects after attempting every required kind without scheduling retries", () =>
  retryFixture(async (state) => {
    state.transport = () => Promise.reject(new Error("ACK missing"));
    await rejects(() => maybeAnnounce(configForRetry()), AggregateError);
    deepStrictEqual(state.calls.map((event) => event.kind), [0, 10002, 10166]);
    strictEqual(state.timers.length, 0);
  }));

Deno.test("announcement ACK state lasts for one generation only", () =>
  retryFixture(async (state) => {
    const monitor = new AnnounceMonitor(
      "1b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f",
      {
        relays: outboxRelays,
        userDataRelays: metadataRelays,
        profile: { name: "Offline test" },
        networks: ["clearnet"],
        frequency: "60",
      },
    );
    monitor.generate();
    await monitor.sign(fixtureKey);
    const ids = await monitor.publish();
    strictEqual(ids.length, 3);
    deepStrictEqual(await monitor.publish(), ids);
    strictEqual(state.calls.length, 3, "ACKed events must not be replayed");
    monitor.monProfile = {};
    monitor.generate();
    await monitor.sign(fixtureKey);
    strictEqual((await monitor.publish()).length, 2);
    strictEqual(state.calls.length, 5);
  }));

Deno.test("real announcement category counter reaches health metrics only after full recovery", () =>
  retryFixture(async (state) => {
    const config = configForRetry({ maxRetries: 1, initialBackoffMs: 10 });
    const queue = new QueueManager(1, 1, config);
    const health = () =>
      buildHealthSnapshot({
        queueManager: queue,
        privkey: fixtureKey,
        expiredRelaysCount: 0,
        heartbeat: { startupTime: Date.now(), checkLoop: Date.now() },
        errorTracker: new ErrorTracker(),
        thresholds: {
          checkIdleMs: 60_000,
          publishBacklogMax: 100,
          errorRatePerMin: 10,
          startupGraceMs: 60_000,
        },
      });
    queue.addPublishJob(() => Promise.resolve(), { category: "check" });
    await queue.waitEmpty([queue.publishQueue]);
    strictEqual((await health()).metrics.publishQueue.published, 1);
    strictEqual(
      (await health()).metrics.publishQueue.publishedAnnouncements,
      0,
    );
    state.transport = (event) =>
      event.kind === 0
        ? Promise.reject(new Error("first ACK missing"))
        : Promise.resolve("owned ACK");
    await maybeAnnounce(config, queue);
    await queue.waitEmpty([queue.publishQueue]);
    strictEqual(queue.getPublishingStats().failed, 1);
    strictEqual(
      (await health()).metrics.publishQueue.publishedAnnouncements,
      0,
    );
    const ack = Promise.withResolvers<unknown>();
    state.transport = () => ack.promise;
    state.timers[0].callback();
    await Promise.resolve();
    strictEqual(queue.publishQueue.pending, 1);
    strictEqual(queue.getPublishingStats().retrying, 1);
    strictEqual(
      (await health()).metrics.publishQueue.publishedAnnouncements,
      0,
    );
    ack.resolve("owned ACK");
    await queue.waitEmpty([queue.publishQueue]);
    strictEqual(
      (await health()).metrics.publishQueue.publishedAnnouncements,
      1,
    );
    strictEqual(queue.getPublishingStats().retrying, 0);
  }));
