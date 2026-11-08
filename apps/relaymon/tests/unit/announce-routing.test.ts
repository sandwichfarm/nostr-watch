import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { Publisher } from "../../../../internal/publisher/src/Publisher.ts";
import { maybeAnnounce } from "../../src/utils/announce.ts";
import type { Config } from "../../src/types/config.ts";
import type { QueueManager } from "../../src/utils/queueManager.ts";

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
        strictEqual(calls.length, 3);
        const expectedMetadata = destinations ?? defaultMetadataRelays;
        for (const kind of [0, 10002]) {
          deepStrictEqual(
            calls.find((call) => call.kind === kind)?.relays,
            expectedMetadata,
          );
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
