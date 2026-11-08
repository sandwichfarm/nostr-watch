import { deepStrictEqual, ok, rejects, strictEqual, throws } from "node:assert";
import { Publisher } from "../../../../internal/publisher/src/Publisher.ts";
import {
  createPublicationContext,
  effectivePublicationRelays,
  encodePublicationFrame,
  type PublicationChild,
  PublicationContext,
  type PublicationFrame,
  publicationLaunchPlan,
  PublicationProcesses,
  publisherFactory,
} from "../../src/utils/publishTransport.ts";
import type {
  Config,
  PublicationProcessConfig,
} from "../../src/types/config.ts";
const relay = "wss://one.invalid/";
const second = "wss://two.invalid/";
const event = {
  id: "a".repeat(64),
  sig: "b".repeat(128),
  kind: 5,
  pubkey: "c".repeat(64),
  tags: [],
  content: "",
  created_at: 1,
};
const options: PublicationProcessConfig = {
  mode: "per-relay-process",
  expectedRelays: [relay],
  maxChildren: 5,
  maxFrameBytes: 8192,
  maxPendingPerRelay: 2,
  maxRestarts: 1,
  shutdownMs: 1000,
  launch: { mode: "direct", oldSpaceMb: 32, semiSpaceMb: 2 },
};
function config(relays = [relay]): Config {
  return {
    publisher: { relays, transport: { ...options, expectedRelays: relays } },
    relaymon: {},
  } as Config;
}
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
class FakeChild implements PublicationChild {
  statusState = Promise.withResolvers<{ code: number; success: boolean }>();
  status = this.statusState.promise;
  frames: PublicationFrame[] = [];
  output!: ReadableStreamDefaultController<Uint8Array>;
  stdout = new ReadableStream<Uint8Array>({
    start: (controller) => {
      this.output = controller;
    },
  });
  stdin: WritableStream<Uint8Array>;
  ended = false;
  kills = 0;
  constructor(
    readonly relay: string,
    readonly generation: string,
    readonly pid: number,
  ) {
    this.stdin = new WritableStream({
      write: (bytes) => {
        const frame = JSON.parse(new TextDecoder().decode(bytes));
        this.frames.push(frame);
        if (frame.type === "close") this.exit();
      },
    });
    this.send({ v: 1, type: "ready", relay, generation });
  }
  send(frame: PublicationFrame) {
    this.output.enqueue(encodePublicationFrame(frame, options.maxFrameBytes));
  }
  ack(
    frame = this.frames.find((f) => f.type === "publish")!,
    changes: Partial<PublicationFrame> = {},
  ) {
    this.send({
      v: 1,
      type: "ack",
      relay: this.relay,
      generation: this.generation,
      request: frame.request,
      eventId: frame.eventId,
      ackAt: 123,
      ...changes,
    });
  }
  exit() {
    if (this.ended) return;
    this.ended = true;
    this.output.close();
    this.statusState.resolve({ code: 0, success: true });
  }
  kill() {
    this.kills++;
    this.exit();
  }
}
function fixture(relays = [relay], opts = options) {
  const children: FakeChild[] = [];
  const manager = new PublicationProcesses(relays, opts, (r, g) => {
    const child = new FakeChild(r, g, children.length + 10);
    children.push(child);
    return child;
  });
  return { manager, children };
}
Deno.test("injected Publisher normalizes, ACKs and drains its slower lease attempts", async () => {
  const slow = Promise.withResolvers<unknown>();
  const calls: string[] = [];
  let released = 0;
  const p = new Publisher("test", [relay, "wss://one.invalid", second], {
    transport: {
      publish: (r) => {
        calls.push(r);
        return r === relay ? Promise.resolve("ACK") : slow.promise;
      },
      release: () => {
        released++;
      },
    },
  });
  strictEqual(p.pool, undefined);
  strictEqual(await p.publishEvent(event), "ACK");
  deepStrictEqual(calls, [relay, second]);
  const close = p.close();
  await tick();
  strictEqual(released, 0);
  slow.reject(new Error("negative ACK"));
  await close;
  strictEqual(released, 1);
  strictEqual(p.close(), close);
  await rejects(p.publishEvent(event), /closed/);
});
Deno.test("injected Publisher all failures remain failures and release the lease", async () => {
  let released = 0;
  const p = new Publisher("test", [relay, second], {
    transport: {
      publish: () => Promise.reject(new Error("negative ACK")),
      release: () => {
        released++;
      },
    },
  });
  await rejects(p.publishEvent(event), AggregateError);
  await p.close();
  strictEqual(released, 1);
});
Deno.test("effective five-relay union retains omitted defaults and explicit empty metadata", () => {
  const c = config(["wss://relay.nostr.watch", "wss://relaypag.es"]);
  c.monitor = { info: { name: "test" } } as Config["monitor"];
  c.announce = {
    userMetaRelays: [
      "wss://purplepag.es",
      "wss://user.kindpag.es",
      "wss://profiles.nostr1.com",
    ],
  };
  strictEqual(effectivePublicationRelays(c).length, 5);
  c.announce.userMetaRelays = [];
  strictEqual(effectivePublicationRelays(c).length, 2);
  delete c.announce.userMetaRelays;
  strictEqual(effectivePublicationRelays(c).length, 4);
});
Deno.test("missing opt-in context fails closed and default factory stays compatible", async () => {
  throws(() => publisherFactory(config()), /runtime context/);
  const c = config();
  delete c.publisher.transport;
  const p = publisherFactory(c)("test", []);
  ok(p.pool);
  await p.close();
});
Deno.test("startup rejects collapsed/extra destinations before any child launches", async () => {
  const c = config([relay, second]);
  c.publisher.transport!.expectedRelays = [relay];
  let starts = 0;
  const launch = () => {
    starts++;
    throw new Error("unexpected");
  };
  await rejects(createPublicationContext(c, launch), /qualified relay set/);
  strictEqual(starts, 0);
  c.publisher.transport!.expectedRelays = [relay, second];
  c.publisher.transport!.maxChildren = 1;
  await rejects(createPublicationContext(c, launch), /cardinality/);
  strictEqual(starts, 0);
});
Deno.test("child launch has proxy/cache/cert/heap policy without credential or env-file authority", () => {
  const proxied = {
    ...options,
    launch: {
      ...options.launch,
      mode: "proxychains" as const,
      proxychainsBinary: "/usr/bin/proxychains4",
      proxychainsConfig: "/etc/proxychains.conf",
    },
  };
  const plan = publicationLaunchPlan(proxied, relay, "generation", {
    RELAYMON_MODE: "multinet",
    DENO_DIR: "/cache",
    DENO_CERT: "/cert.pem",
    DENO_TLS_CA_STORE: "system",
    LD_PRELOAD: "/usr/lib/libproxychains4.so",
  });
  strictEqual(plan.command, "/usr/bin/proxychains4");
  strictEqual(plan.options.clearEnv, true);
  deepStrictEqual(plan.options.env, {
    RELAYMON_NSEC: "",
    IP_API_KEY: "",
    RELAYMON_KUMA_PUSH_URL: "",
    DENO_DIR: "/cache",
    DENO_TLS_CA_STORE: "system",
  });
  const args = plan.options.args!;
  for (
    const arg of [
      "--cached-only",
      "--no-lock",
      "--no-check",
      "--unstable-sloppy-imports",
      "--cert=/cert.pem",
      "--allow-net=one.invalid",
      "--v8-flags=--max-old-space-size=32,--max-semi-space-size=2",
    ]
  ) ok(args.includes(arg), arg);
  ok(
    !args.some((a) =>
      /env-file|allow-all|allow-run|allow-write|allow-env|allow-ffi/.test(a)
    ),
  );
  throws(
    () =>
      publicationLaunchPlan(options, relay, "g", { RELAYMON_MODE: "multinet" }),
    /requires proxied/,
  );
});
Deno.test("two Publishers reuse one child and closing a lease preserves another owner", async () => {
  const { manager, children } = fixture();
  await manager.start();
  const context = new PublicationContext(manager);
  const first = context.publisherFactory("first", [relay]);
  const other = context.publisherFactory("other", [relay]);
  const a = first.publishEvent(event);
  await tick();
  const b = other.publishEvent({ ...event, id: "d".repeat(64) });
  await tick();
  strictEqual(children.length, 1);
  strictEqual(children[0].frames.length, 1);
  children[0].ack();
  await a;
  await first.close();
  await tick();
  strictEqual(children[0].frames.length, 2);
  strictEqual(children[0].kills, 0);
  children[0].ack(children[0].frames[1]);
  await b;
  await other.close();
  await context.close();
  strictEqual(children[0].ended, true);
});
Deno.test("bounded per-relay queue and frame bytes reject excess admissions", async () => {
  const { manager, children } = fixture();
  await manager.start();
  const first = manager.publish(relay, event);
  const queued = manager.publish(relay, event);
  await rejects(manager.publish(relay, event), /backpressure/);
  children[0].ack();
  await first;
  await tick();
  children[0].ack(children[0].frames[1]);
  await queued;
  await rejects(
    manager.publish(relay, {
      ...event,
      content: "x".repeat(options.maxFrameBytes),
    }),
    /byte limit/,
  );
  await rejects(manager.publish(second, event), /configured union/);
  await manager.close();
});
for (const trailing of ["none", "partial", "duplicate"] as const) {
  Deno.test(`complete buffered ACK survives status-before-reader (${trailing}) exactly once without replay`, async () => {
    const { manager, children } = fixture();
    await manager.start();
    const child = children[0];
    let marked = 0;
    const request = manager.publish(relay, event).then(() => {
      marked++;
    });
    await tick();
    child.statusState.resolve({ code: 0, success: true });
    await tick();
    child.ack();
    if (trailing === "partial") {
      child.output.enqueue(new TextEncoder().encode('{"v":1'));
    }
    if (trailing === "duplicate") child.ack();
    child.exit();
    await request;
    await manager.close();
    strictEqual(marked, 1);
    strictEqual(children.length, 1);
    strictEqual(child.frames.filter((f) => f.type === "publish").length, 1);
  });
}
for (
  const failure of [
    "partial",
    "malformed",
    "oversize",
    "wrong-event",
    "wrong-relay",
    "wrong-generation",
  ] as const
) {
  Deno.test(`uncertain ${failure} response never ACKs or replays`, async () => {
    const { manager, children } = fixture();
    await manager.start();
    const child = children[0];
    let marked = false;
    const attempt = manager.publish(relay, event).then(() => {
      marked = true;
    });
    const rejected = rejects(attempt);
    await tick();
    if (failure === "partial") {
      child.output.enqueue(new TextEncoder().encode('{"v":1'));
    } else if (failure === "malformed") {
      child.output.enqueue(new TextEncoder().encode("invalid\n"));
    } else if (failure === "oversize") {
      child.output.enqueue(new Uint8Array(options.maxFrameBytes + 1));
    } else {child.ack(
        undefined,
        failure === "wrong-event"
          ? { eventId: "f".repeat(64) }
          : failure === "wrong-relay"
          ? { relay: second }
          : { generation: "old" },
      );}
    child.exit();
    await rejected;
    await manager.close();
    strictEqual(marked, false);
    strictEqual(children.length, 1);
  });
}
Deno.test("producer stop precedes admitted check publication, lease drain and child close", async () => {
  const { manager, children } = fixture();
  await manager.start();
  const context = new PublicationContext(manager);
  const order: string[] = [];
  context.onStop(() => order.push("stop producer"));
  context.onDrain(async () => {
    order.push("check finishes");
    const p = context.publisherFactory("admitted", [relay]);
    const result = p.publishEvent(event);
    await tick();
    children[0].ack();
    await result;
    await p.close();
    order.push("publication ACK");
  });
  const closing = context.close();
  strictEqual(context.close(), closing);
  await closing;
  deepStrictEqual(order, [
    "stop producer",
    "check finishes",
    "publication ACK",
  ]);
  throws(() => context.publisherFactory("late", [relay]), /closed/);
  strictEqual(children[0].ended, true);
});

Deno.test("concurrent new admissions during exit-drain share exactly one replacement child", async () => {
  const { manager, children } = fixture([relay], {
    ...options,
    maxPendingPerRelay: 4,
  });
  await manager.start();
  const old = children[0];
  const oldAttempt = manager.publish(relay, event);
  const oldRejected = rejects(oldAttempt);
  await tick();
  old.statusState.resolve({ code: 1, success: false });
  await tick();
  const a = manager.publish(relay, { ...event, id: "d".repeat(64) });
  const b = manager.publish(relay, { ...event, id: "e".repeat(64) });
  old.exit();
  await oldRejected;
  await tick();
  strictEqual(children.length, 2);
  const replacement = children[1];
  strictEqual(replacement.frames.length, 1);
  replacement.ack();
  await a;
  await tick();
  replacement.ack(replacement.frames[1]);
  await b;
  strictEqual(children.length, 2);
  strictEqual(old.frames.filter((f) => f.type === "publish").length, 1);
  await manager.close();
});

Deno.test("already queued old-generation work rejects rather than hanging or replaying", async () => {
  const { manager, children } = fixture();
  await manager.start();
  const a = rejects(manager.publish(relay, event));
  const b = rejects(manager.publish(relay, event));
  await tick();
  children[0].exit();
  await Promise.all([a, b]);
  strictEqual(children[0].frames.length, 1);
  await manager.close();
});

Deno.test("actual child SDK NOTICE stays on stderr and positive OK reaches the bounded pipe", async () => {
  const { finalizeEvent } = await import("nostr-tools");
  const signed = finalizeEvent({
    kind: 5,
    tags: [],
    content: "",
    created_at: 1,
  }, new Uint8Array(32).fill(1));
  const diagnostics: Promise<Uint8Array>[] = [];
  const processes = new PublicationProcesses(
    [relay],
    options,
    (r, generation) => {
      const child = new Deno.Command(Deno.execPath(), {
        args: [
          "run",
          "--cached-only",
          "--no-lock",
          "--no-check",
          "--unstable-sloppy-imports",
          `--config=${new URL("../../deno.json", import.meta.url).pathname}`,
          new URL(
            "../helpers/publication-process-fake-child.ts",
            import.meta.url,
          ).pathname,
          r,
          generation,
          String(options.maxFrameBytes),
        ],
        clearEnv: true,
        env: {
          DENO_DIR: Deno.env.get("DENO_DIR") ??
            `${Deno.env.get("HOME")}/.cache/deno`,
          RELAYMON_NSEC: "",
          IP_API_KEY: "",
          RELAYMON_KUMA_PUSH_URL: "",
        },
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
      }).spawn();
      diagnostics.push(new Response(child.stderr).bytes());
      return child;
    },
  );
  try {
    await processes.start();
    const result = await processes.publish(relay, signed) as {
      ackAt: number;
      pid: number;
    };
    ok(result.ackAt > 0);
    ok(result.pid > 0);
  } finally {
    await processes.close();
  }
  const text = new TextDecoder().decode(await diagnostics[0]);
  ok(text.includes("Publication SDK diagnostic"));
  ok(!text.includes("fixture diagnostic"));
  strictEqual(processes.outcomes.forced, false);
});

Deno.test("EOF with blocked stdin write arms reap bound before awaiting writer close", async () => {
  const status = Promise.withResolvers<{ code: number; success: boolean }>();
  const writing = Promise.withResolvers<void>();
  let stdout!: ReadableStreamDefaultController<Uint8Array>;
  let stdin!: WritableStreamDefaultController;
  let kills = 0;
  const manager = new PublicationProcesses([relay], {
    ...options,
    shutdownMs: 100,
  }, (r, g) => ({
    pid: 100,
    status: status.promise,
    stdout: new ReadableStream({
      start: (controller) => {
        stdout = controller;
        controller.enqueue(
          encodePublicationFrame({
            v: 1,
            type: "ready",
            relay: r,
            generation: g,
          }, 8192),
        );
      },
    }),
    stdin: new WritableStream({
      start: (controller) => {
        stdin = controller;
      },
      write: () => writing.promise,
    }),
    kill: () => {
      kills++;
      stdin.error(new Error("fixture killed"));
      writing.reject(new Error("fixture killed"));
      status.resolve({ code: 137, success: false });
    },
  }));
  await manager.start();
  const pending = rejects(manager.publish(relay, event));
  await tick();
  stdout.close();
  await pending;
  await manager.close();
  strictEqual(kills, 1);
  strictEqual(manager.outcomes.forced, true);
});

Deno.test("complete ACK buffered before a queued shutdown deadline is classified first", async () => {
  const { manager, children } = fixture([relay], {
    ...options,
    shutdownMs: 100,
  });
  await manager.start();
  const child = children[0];
  const pending = manager.publish(relay, event);
  await tick();
  child.statusState.resolve({ code: 0, success: true });
  child.ack();
  child.exit();
  const closing = manager.close();
  const end = performance.now() + 120;
  while (performance.now() < end) { /* bounded parent event-loop delay */ }
  await pending;
  await closing;
  strictEqual(manager.outcomes.failures, 0);
  strictEqual(child.frames.filter((f) => f.type === "publish").length, 1);
});

Deno.test("context producer timeout reaps children and reports failure", async () => {
  const { manager, children } = fixture([relay], {
    ...options,
    shutdownMs: 100,
  });
  await manager.start();
  const context = new PublicationContext(manager);
  context.onDrain(() => new Promise(() => {}));
  await rejects(context.close(), /shutdown bound/);
  strictEqual(children[0].ended, true);
});

Deno.test("a failed stop hook cannot bypass remaining hooks or child reaping", async () => {
  const { manager, children } = fixture();
  await manager.start();
  const context = new PublicationContext(manager);
  let stopped = false;
  context.onStop(() => {
    throw new Error("fixture stop failure");
  });
  context.onStop(() => {
    stopped = true;
  });
  await rejects(context.close(), /fixture stop failure/);
  strictEqual(stopped, true);
  strictEqual(children[0].ended, true);
});

for (const skipPid of [true, false]) {
  Deno.test(`signal lifecycle owns repeated termination with skipPID=${skipPid}`, async () => {
    const { installPublicationSignals } = await import(
      "../../src/utils/publishTransport.ts"
    );
    const { manager, children } = fixture();
    await manager.start();
    const context = new PublicationContext(manager);
    const handlers = new Map<string, () => void>();
    let stopCalls = 0;
    let closing: Promise<void> | undefined;
    context.onStop(() => {
      stopCalls++;
    });
    const uninstall = installPublicationSignals(context, () => {
      closing = context.close();
    }, {
      addSignalListener: (signal, handler) => {
        handlers.set(signal, handler);
      },
      removeSignalListener: (signal) => {
        handlers.delete(signal);
      },
    });
    // Registration has no dependency on creation or ownership of a PID file.
    strictEqual(handlers.size, 2);
    handlers.get("SIGTERM")!();
    const first = closing;
    handlers.get("SIGINT")!();
    strictEqual(first, closing);
    await closing;
    strictEqual(stopCalls, 1);
    strictEqual(children[0].ended, true);
    uninstall();
    strictEqual(handlers.size, 0);
  });
}

Deno.test("unsupported supplied transport modes and inherited policies fail closed", async () => {
  const { validateConfig } = await import("../../src/types/config.ts");
  for (const mode of ["typo", null, false, ""]) {
    const c = config();
    (c.publisher as unknown as { transport: unknown }).transport =
      typeof mode === "string" ? { mode } : mode;
    throws(() => publisherFactory(c), /Unsupported/);
    await rejects(createPublicationContext(c), /Unsupported/);
    throws(
      () =>
        validateConfig({
          ...c,
          monitor: {
            slug: "fixture",
            info: { name: "fixture", about: "fixture" },
          },
        }),
      /Unsupported/,
    );
  }
  for (
    const name of ["HTTP_PROXY", "SSL_CERT_FILE", "DENO_FLAGS", "NODE_OPTIONS"]
  ) {
    throws(
      () => publicationLaunchPlan(options, relay, "g", { [name]: "fixture" }),
      /Unsupported inherited/,
    );
  }
  throws(
    () => publicationLaunchPlan(options, "wss://fixture.onion/", "g", {}),
    /requires proxychains/,
  );
  throws(
    () =>
      publicationLaunchPlan(options, relay, "g", {
        LD_PRELOAD: "/usr/lib/libproxychains.so:/other.so",
      }),
    /Unsupported|requires proxied/,
  );
});

Deno.test("five configured destinations have five persistent distinct owners and duplicate memberships share them", async () => {
  const relays = Array.from(
    { length: 5 },
    (_, i) => `wss://owned-${i}.invalid/`,
  );
  const { manager, children } = fixture(relays, {
    ...options,
    expectedRelays: relays,
  });
  await manager.start();
  const context = new PublicationContext(manager);
  strictEqual(children.length, 5);
  strictEqual(new Set(manager.snapshot().map((s) => s.pid)).size, 5);
  const a = context.publisherFactory("monitor", [relays[0], relays[1]]);
  const b = context.publisherFactory("deletion", [relays[0].slice(0, -1)]);
  const first = a.publishEvent(event);
  const other = b.publishEvent({ ...event, id: "e".repeat(64) });
  await tick();
  strictEqual(children[0].frames.length, 1);
  strictEqual(children[1].frames.length, 1);
  children[0].ack();
  children[1].ack();
  await first;
  await tick();
  children[0].ack(children[0].frames[1]);
  await other;
  await a.close();
  await b.close();
  strictEqual(children.length, 5);
  await context.close();
  ok(children.every((c) => c.ended));
});

Deno.test("parent 128/8 V8 heap policy remains unchanged while explicit child 32/2 supersedes it", () => {
  const inherited = Object.freeze({
    DENO_V8_FLAGS: "--max-old-space-size=128,--max-semi-space-size=8",
    DENO_DIR: "/cache",
    DENO_CERT: "/cert.pem",
    DENO_TLS_CA_STORE: "system",
    RELAYMON_MODE: "multinet",
    LD_PRELOAD: "/usr/lib/libproxychains4.so",
  });
  const originalEnvironment = Deno.env.get("DENO_V8_FLAGS");
  const proxied = {
    ...options,
    launch: {
      ...options.launch,
      mode: "proxychains" as const,
      proxychainsBinary: "/usr/bin/proxychains4",
      proxychainsConfig: "/etc/proxychains.conf",
    },
  };
  const plan = publicationLaunchPlan(proxied, relay, "heap-fixture", inherited);
  strictEqual(
    inherited.DENO_V8_FLAGS,
    "--max-old-space-size=128,--max-semi-space-size=8",
  );
  strictEqual(Deno.env.get("DENO_V8_FLAGS"), originalEnvironment);
  strictEqual(plan.options.env?.DENO_V8_FLAGS, undefined);
  strictEqual(plan.options.env?.DENO_DIR, "/cache");
  strictEqual(plan.options.env?.DENO_TLS_CA_STORE, "system");
  ok(plan.options.args?.includes("--cert=/cert.pem"));
  ok(
    plan.options.args?.includes(
      "--v8-flags=--max-old-space-size=32,--max-semi-space-size=2",
    ),
  );
  ok(
    !plan.options.args?.some((arg) =>
      arg.includes("max-old-space-size=128") ||
      arg.includes("max-semi-space-size=8")
    ),
  );
  strictEqual(plan.command, "/usr/bin/proxychains4");
});

Deno.test("unsupported or malformed inherited V8 policy fails rather than being silently discarded", () => {
  for (
    const policy of [
      "--expose-gc",
      "--max-old-space-size=128,--jitless",
      "--max-old-space-size=0",
      "--max-semi-space-size=-1",
      "--max-old-space-size=128,--max-old-space-size=256",
      "--max-old-space-size=128,",
    ]
  ) {
    throws(
      () =>
        publicationLaunchPlan(options, relay, "heap-fixture", {
          DENO_V8_FLAGS: policy,
        }),
      /Unsupported inherited publication V8 policy/,
    );
  }
});
