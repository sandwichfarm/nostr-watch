import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import { Publisher } from "../../../../internal/publisher/src/Publisher.ts";
import { deleteRelayCheckEvent } from "../../src/utils/deletion.ts";
import { db, initializeDB, isDeletionPublished } from "../../src/db/db.ts";
import type { Config } from "../../src/types/config.ts";
import type { QueueManager } from "../../src/utils/queueManager.ts";

Deno.test("Publisher close waits for every relay without delaying first-success result", async () => {
  const publisher = new Publisher("synthetic", ["ws://unused.invalid"]);
  const slow = Promise.withResolvers<string>();
  let closed = false;
  publisher.pool.publish = () => [Promise.resolve("first ACK"), slow.promise];
  publisher.pool.close = () => {
    closed = true;
  };
  assertEquals(await publisher.publishEvent({}), "first ACK");
  const closing = publisher.close();
  await Promise.resolve();
  assertEquals(
    closed,
    false,
    "must not cancel the slower relay after the first ACK",
  );
  await assertRejects(() => publisher.publishEvent({}), Error, "closed");
  slow.resolve("second ACK");
  await closing;
  assertEquals(closed, true);
});

Deno.test("Publisher close handles a later rejection and is idempotent", async () => {
  const publisher = new Publisher("synthetic", ["ws://unused.invalid"]);
  const slow = Promise.withResolvers<string>();
  let closes = 0;
  publisher.pool.publish = () => [Promise.resolve("first ACK"), slow.promise];
  publisher.pool.close = () => {
    closes++;
  };
  assertEquals(await publisher.publishEvent({}), "first ACK");
  const closing = publisher.close();
  slow.reject(new Error("second relay rejected"));
  await closing;
  await publisher.close();
  assertEquals(closes, 1);
});

Deno.test("Publisher close still releases connections after all relays reject", async () => {
  const publisher = new Publisher("synthetic", ["ws://unused.invalid"]);
  let closed = false;
  publisher.pool.publish = () => [Promise.reject(new Error("rejected"))];
  publisher.pool.close = () => {
    closed = true;
  };
  await assertRejects(() => publisher.publishEvent({}), AggregateError);
  await publisher.close();
  assertEquals(closed, true);
});

function collector(accepted: boolean | null) {
  const sockets = new Set<WebSocket>();
  let opened = 0;
  let closed = 0;
  let events = 0;
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    (request) => {
      const { socket, response } = Deno.upgradeWebSocket(request);
      sockets.add(socket);
      opened++;
      socket.onclose = () => {
        closed++;
        sockets.delete(socket);
      };
      socket.onmessage = (message) => {
        const frame = JSON.parse(message.data);
        if (frame[0] === "EVENT") {
          events++;
          if (accepted === null) return;
          socket.send(
            JSON.stringify([
              "OK",
              frame[1].id,
              accepted,
              accepted ? "" : "blocked: synthetic rejection",
            ]),
          );
        }
      };
      return response;
    },
  );
  return {
    url: `ws://127.0.0.1:${server.addr.port}`,
    stats: () => ({ opened, closed, events }),
    async assertClosed() {
      for (let i = 0; i < 50 && opened !== closed; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assertEquals(
        closed,
        opened,
        "every short-lived deletion publisher must close its socket",
      );
    },
    async stop() {
      for (const socket of sockets) socket.close();
      await server.shutdown();
    },
  };
}

// The existing migration writes a purge report in cwd, even for an empty DB.
const originalCwd = Deno.cwd();
const scratch = await Deno.makeTempDir({ prefix: "deletion-lifecycle-" });
try {
  Deno.chdir(scratch);
  await initializeDB(":memory:", false);
} finally {
  Deno.chdir(originalCwd);
  await Deno.remove(scratch, { recursive: true });
}

for (const queued of [false, true]) {
  for (const accepted of [true, false]) {
    Deno.test(`deletion ${queued ? "queued" : "direct"} releases sockets after ${accepted ? "ACK" : "rejection"}`, async () => {
      const oldKey = Deno.env.get("RELAYMON_NSEC");
      Deno.env.set("RELAYMON_NSEC", "0".repeat(63) + "1");
      const relay = collector(accepted);
      const config = { publisher: { relays: [relay.url] } } as Config;
      try {
        for (let i = 0; i < 8; i++) {
          const url = `wss://lifecycle-${queued}-${accepted}-${i}.invalid`;
          db.query(
            "INSERT INTO relay_status (url, ignore, deletion_published_at) VALUES (?, 1, 0)",
            [url],
          );
          let job: (() => Promise<void>) | undefined;
          const queue = queued
            ? {
              addPublishJob(fn: () => Promise<void>) {
                job = fn;
              },
            } as unknown as QueueManager
            : undefined;
          const result = await deleteRelayCheckEvent(
            url,
            "synthetic deletion",
            config,
            queue,
          );
          assertEquals(result, queued || accepted);
          if (queued) {
            assert(job, "queued publication must remain a job");
            if (accepted) await job();
            else await assertRejects(job, AggregateError);
          }
          assertEquals(
            isDeletionPublished(url),
            accepted,
            "durable success must require ACK",
          );
          await relay.assertClosed();
        }
        assertEquals(relay.stats(), { opened: 8, closed: 8, events: 8 });
      } finally {
        await relay.stop();
        if (oldKey === undefined) Deno.env.delete("RELAYMON_NSEC");
        else Deno.env.set("RELAYMON_NSEC", oldKey);
      }
    });
  }
}

Deno.test("Publisher close releases a silent relay after its existing publish timeout", async () => {
  const relay = collector(null);
  const publisher = new Publisher("synthetic", [relay.url]);
  try {
    const connection = await publisher.pool.ensureRelay(relay.url);
    connection.publishTimeout = 30;
    const started = Date.now();
    await assertRejects(
      () => publisher.publishEvent({ id: "0".repeat(64) }),
      AggregateError,
    );
    await publisher.close();
    assert(
      Date.now() - started < 2000,
      "cleanup must settle after the SDK timeout",
    );
    await relay.assertClosed();
  } finally {
    await publisher.close();
    await relay.stop();
  }
});
