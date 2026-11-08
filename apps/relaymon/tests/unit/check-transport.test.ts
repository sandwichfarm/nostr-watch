// deno-lint-ignore-file no-import-prefix -- Reuse the existing versioned offline assertion fixture.
import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  checkLaunchPlan,
  CheckProcesses,
} from "../../src/utils/checkTransport.ts";
import {
  CHECK_PROTOCOL,
  checkDeadline,
  type CheckFrame,
  type CheckRequest,
  checkRequest,
  encodeCheckFrame,
  finiteJson,
  readCheckFrames,
} from "../../src/utils/checkTransportProtocol.ts";
import {
  type CheckProcessConfig,
  type Config,
  validateCheckProcessConfig,
} from "../../src/types/config.ts";
import type { PublicationChild } from "../../src/utils/publishTransport.ts";

const options: CheckProcessConfig = {
  mode: "process",
  maxChildren: 1,
  maxPending: 1,
  maxFrameBytes: 65536,
  maxRestarts: 1,
  shutdownMs: 100,
  launch: { mode: "direct", oldSpaceMb: 32, semiSpaceMb: 2 },
};
const input: CheckRequest = {
  url: "ws://owned.invalid/",
  checks: ["open", "read", "info"],
  options: { timeouts: { open: 30000, read: 1000 }, logLevel: "error" },
  profile: "default",
};
const result = {
  url: input.url,
  network: "clearnet" as const,
  hostname: "owned.invalid",
  protocol: "ws:",
  parent: null,
  ignore: false,
  adapters: ["owned"],
  checked_at: -1,
  checked_by: "",
  open: { data: true, duration: 1 },
  read: {
    data: false,
    duration: 2,
    status: "error",
    message: "Not NIP-01 compatible",
  },
  info: {
    data: { name: "owned", unknown: { future: [1, "preserved"] } },
    duration: 3,
  },
};
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

class FakeChild implements PublicationChild {
  pid = 100;
  stdout: ReadableStream<Uint8Array>;
  stdin: WritableStream<Uint8Array>;
  status: Promise<{ code: number; success: boolean }>;
  controller!: ReadableStreamDefaultController<Uint8Array>;
  resolveStatus!: (s: { code: number; success: boolean }) => void;
  killed: string[] = [];
  closed = false;
  inputClosed = false;
  failInputClose = false;
  retainOutputOnKill = false;
  received?: CheckRequest;
  constructor(
    readonly base: Omit<CheckFrame, "type">,
    onCheck?: (child: FakeChild) => void,
  ) {
    this.stdout = new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
    });
    this.status = new Promise((resolve) => {
      this.resolveStatus = resolve;
    });
    this.stdin = new WritableStream({
      write: (bytes) => {
        const frame = JSON.parse(new TextDecoder().decode(bytes));
        this.received = frame.input;
        if (onCheck) onCheck(this);
        else this.complete();
      },
      close: () => {
        this.inputClosed = true;
        if (this.failInputClose) throw new Error("closed process pipe");
      },
    });
    queueMicrotask(() => this.emit({ type: "ready" }));
  }
  emit(frame: Partial<CheckFrame> & { type: CheckFrame["type"] }) {
    this.controller.enqueue(
      encodeCheckFrame({ ...this.base, ...frame }, options.maxFrameBytes),
    );
  }
  accepted(ms?: number) {
    const d = checkDeadline(this.received ?? input);
    this.emit({
      type: "accepted",
      deadlineMs: ms ?? d.ms,
      deadlineReason: d.reason,
      orderedChecks: d.orderedChecks,
    });
  }
  complete(code = 0, statusFirst = false, holdStatus = false) {
    this.accepted();
    this.emit({ type: "result", result });
    if (statusFirst && !holdStatus) {
      this.resolveStatus({ code, success: code === 0 });
    }
    this.controller.close();
    this.closed = true;
    if (!statusFirst && !holdStatus) {
      queueMicrotask(() => this.resolveStatus({ code, success: code === 0 }));
    }
  }
  kill(signal: Deno.Signal = "SIGTERM") {
    this.killed.push(signal);
    if (!this.closed && !this.retainOutputOnKill) {
      this.controller.close();
      this.closed = true;
    }
    this.resolveStatus({ code: 137, success: false });
  }
}

function manager(action?: (child: FakeChild) => void) {
  const children: FakeChild[] = [];
  const pool = new CheckProcesses(options, (request, generation, id) => {
    const child = new FakeChild({
      v: CHECK_PROTOCOL,
      generation,
      request: id,
      url: request.url,
    }, action);
    children.push(child);
    return child;
  });
  return { pool, children };
}

Deno.test("typed check result retains read.message and unknown NIP-11 fields", async () => {
  const { pool, children } = manager();
  assertEquals(await pool.check(input), result);
  assertEquals(children[0].received?.options, input.options);
  assertEquals(pool.snapshot().active, []);
  await pool.close();
});

for (const statusFirst of [false, true]) {
  Deno.test(`complete buffered frame wins exit1 ${statusFirst ? "before" : "after"} drain`, async () => {
    const { pool } = manager((child) => child.complete(1, statusFirst));
    assertEquals(await pool.check(input), result);
    assertEquals(pool.outcomes.failures, 1);
    await pool.close();
  });
}

Deno.test("complete valid frame survives a late broken stdin pipe and exit1", async () => {
  const { pool } = manager((child) => {
    child.failInputClose = true;
    child.complete(1);
  });
  assertEquals(await pool.check(input), result);
  assertEquals(pool.outcomes.failures, 1);
  await pool.close();
});

Deno.test("operation error frame cannot exempt an unexplained failed worker exit", async () => {
  const { pool, children } = manager((child) => {
    child.accepted();
    child.emit({ type: "error" });
    child.controller.close();
    child.closed = true;
    child.resolveStatus({ code: 1, success: false });
  });
  await assertRejects(() => pool.check(input));
  await assertRejects(() => pool.check(input));
  await assertRejects(() => pool.check(input), Error, "failure limit");
  assertEquals(children.length, 2);
  await pool.close();
});

Deno.test("lease is not reused until stdout EOF AND process status settle", async () => {
  const { pool, children } = manager((child) => child.complete(0, false, true));
  const first = pool.check(input);
  const second = pool.check(input);
  for (let i = 0; i < 20; i++) await tick();
  assertEquals(children.length, 1);
  assertEquals(pool.snapshot().active.length, 1);
  children[0].resolveStatus({ code: 0, success: true });
  await first;
  for (let i = 0; i < 20; i++) await tick();
  assertEquals(children.length, 2);
  children[1].resolveStatus({ code: 0, success: true });
  await second;
  await pool.close();
});

Deno.test("three accepted operation failures do not poison later normal admission", async () => {
  let fail = true;
  const { pool, children } = manager((child) => {
    if (!fail) return child.complete();
    child.accepted();
    child.emit({ type: "error" });
    child.controller.close();
    child.closed = true;
    child.resolveStatus({ code: 0, success: true });
  });
  for (let i = 0; i < 3; i++) await assertRejects(() => pool.check(input));
  fail = false;
  assertEquals(await pool.check(input), result);
  assertEquals(children.length, 4);
  assertEquals(pool.outcomes.failures, 3);
  await pool.close();
});

Deno.test("clean validated result and reap reset consecutive unexpected failures", async () => {
  let crash = true;
  const { pool, children } = manager((child) =>
    crash ? child.kill() : child.complete()
  );
  for (let i = 0; i < 3; i++) {
    crash = true;
    await assertRejects(() => pool.check(input));
    crash = false;
    assertEquals(await pool.check(input), result);
  }
  assertEquals(children.length, 6);
  assertEquals(pool.outcomes.failures, 3);
  await pool.close();
});

Deno.test("consecutive unexpected worker faults still fail admission closed", async () => {
  const { pool, children } = manager((child) => child.kill());
  await assertRejects(() => pool.check(input));
  await assertRejects(() => pool.check(input));
  await assertRejects(() => pool.check(input), Error, "failure limit");
  assertEquals(children.length, 2);
  await pool.close();
});

Deno.test("parent retains stdin until result and closes it before slot reuse", async () => {
  const { pool, children } = manager((child) => child.accepted());
  const pending = pool.check(input);
  for (let i = 0; i < 20; i++) await tick();
  assertEquals(children[0].inputClosed, false);
  children[0].emit({ type: "result", result });
  for (let i = 0; i < 20; i++) await tick();
  assertEquals(children[0].inputClosed, true);
  assertEquals(pool.snapshot().active.length, 1);
  children[0].controller.close();
  children[0].closed = true;
  children[0].resolveStatus({ code: 0, success: true });
  assertEquals(await pending, result);
  await pool.close();
});

Deno.test("accepted operation expiry is per-request and permits later valid work", async () => {
  let expire = true;
  const { pool, children } = manager((child) =>
    expire ? child.accepted() : child.complete()
  );
  const short = {
    ...input,
    options: { timeout: { open: 1, read: 1, info: 1 } },
  };
  for (let i = 0; i < 3; i++) {
    await assertRejects(() => pool.check(short), Error, "IPC deadline");
  }
  expire = false;
  assertEquals(await pool.check(input), result);
  assertEquals(children.length, 4);
  assertEquals(pool.outcomes.failures, 3);
  await pool.close();
});

Deno.test("numeric pending operations use the declared IPC timer without poisoning normal work", async () => {
  const original = globalThis.setTimeout;
  let expireOperation: (() => void) | undefined;
  globalThis.setTimeout =
    ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
      if (ms !== 10000) return original(handler, ms, ...args);
      expireOperation = () => {
        if (typeof handler === "function") handler(...args);
      };
      return -1;
    }) as typeof setTimeout;
  let numeric = true;
  const { pool, children } = manager((child) =>
    numeric ? child.accepted() : child.complete()
  );
  try {
    const periodic: CheckRequest = {
      ...input,
      checks: ["info"],
      options: { timeout: 10000 },
      profile: "info-only",
    };
    for (let i = 0; i < 3; i++) {
      const pending = pool.check(periodic);
      const rejected = assertRejects(() => pending, Error, "IPC deadline");
      for (let j = 0; j < 20; j++) await tick();
      assertEquals(children[i].inputClosed, false);
      assert(expireOperation);
      expireOperation();
      await rejected;
      assertEquals(pool.snapshot().active, []);
    }
    numeric = false;
    assertEquals(await pool.check(input), result);
    assertEquals(children.length, 4);
    assertEquals(pool.outcomes.failures, 3);
  } finally {
    globalThis.setTimeout = original;
    await pool.close();
  }
});

Deno.test("expected operation failure neither increments nor resets unexpected breaker", async () => {
  let mode: "crash" | "operation" = "crash";
  const { pool, children } = manager((child) => {
    if (mode === "crash") return child.kill();
    child.accepted();
    child.emit({ type: "error" });
    child.controller.close();
    child.closed = true;
    child.resolveStatus({ code: 0, success: true });
  });
  await assertRejects(() => pool.check(input));
  mode = "operation";
  await assertRejects(() => pool.check(input));
  mode = "crash";
  await assertRejects(() => pool.check(input));
  await assertRejects(() => pool.check(input), Error, "failure limit");
  assertEquals(children.length, 3);
  await pool.close();
});

Deno.test("child crash is infrastructure rejection, never an offline result or replay", async () => {
  const { pool, children } = manager((child) => child.kill());
  await assertRejects(() => pool.check(input));
  assertEquals(children.length, 1);
  await pool.close();
});

Deno.test("duplicate or foreign frame rejects even after a complete result", async () => {
  for (const foreign of [false, true]) {
    const { pool } = manager((child) => {
      child.accepted();
      child.emit({ type: "result", result });
      child.emit(
        foreign
          ? { type: "result", generation: "foreign", result }
          : { type: "result", result },
      );
    });
    await assertRejects(() => pool.check(input));
    await pool.close();
  }
});

Deno.test("child cannot choose an arbitrary outer deadline", async () => {
  const { pool } = manager((child) => child.accepted(2147483647));
  await assertRejects(() => pool.check(input));
  await pool.close();
});

Deno.test("outer deadline cancels/reaps only the owned child and rejects, without replay", async () => {
  const { pool, children } = manager((child) => child.accepted());
  const short = {
    ...input,
    options: { timeout: { open: 1, read: 1, info: 1 } },
  };
  await assertRejects(() => pool.check(short), Error, "IPC deadline");
  assertEquals(children.length, 1);
  assertEquals(children[0].killed, ["SIGKILL"]);
  assertEquals(pool.snapshot().active, []);
  await pool.close();
});

Deno.test("result first received after an expired operation deadline is rejected", async () => {
  const { pool } = manager((child) => {
    child.retainOutputOnKill = true;
    child.accepted();
    setTimeout(() => {
      child.emit({ type: "result", result });
      child.controller.close();
      child.closed = true;
    }, 8);
  });
  const short = {
    ...input,
    options: { timeout: { open: 1, read: 1, info: 1 } },
  };
  await assertRejects(() => pool.check(short), Error, "IPC deadline");
  await pool.close();
});

Deno.test("three expired operations with valid late frames still admit healthy work", async () => {
  let late = true;
  const { pool, children } = manager((child) => {
    if (!late) return child.complete();
    child.retainOutputOnKill = true;
    child.accepted();
    setTimeout(() => {
      child.emit({ type: "result", result });
      child.controller.close();
      child.closed = true;
    }, 8);
  });
  const short = {
    ...input,
    options: { timeout: { open: 1, read: 1, info: 1 } },
  };
  for (let i = 0; i < 3; i++) {
    await assertRejects(() => pool.check(short), Error, "IPC deadline");
  }
  late = false;
  assertEquals(await pool.check(input), result);
  assertEquals(children.length, 4);
  assertEquals(pool.outcomes.failures, 3);
  await pool.close();
});

Deno.test("three expired late errors with broken stdin do not poison later normal work", async () => {
  let late = true;
  const { pool, children } = manager((child) => {
    if (!late) return child.complete();
    child.retainOutputOnKill = true;
    child.failInputClose = true;
    child.accepted();
    setTimeout(() => {
      child.emit({ type: "error" });
      child.controller.close();
      child.closed = true;
    }, 8);
  });
  const short = {
    ...input,
    options: { timeout: { open: 1, read: 1, info: 1 } },
  };
  for (let i = 0; i < 3; i++) {
    await assertRejects(() => pool.check(short), Error, "IPC deadline");
  }
  late = false;
  assertEquals(await pool.check(input), result);
  assertEquals(children.length, 4);
  assertEquals(pool.outcomes.failures, 3);
  await pool.close();
});

Deno.test("late corrupt, foreign, or duplicate frames remain unexpected faults", async () => {
  for (
    const mutation of [
      "corrupt",
      "foreign",
      "duplicate",
      "duplicate-error",
    ] as const
  ) {
    const { pool, children } = manager((child) => {
      child.retainOutputOnKill = true;
      child.accepted();
      setTimeout(() => {
        child.emit(
          mutation === "duplicate-error"
            ? { type: "error" }
            : mutation === "foreign"
            ? { type: "result", generation: "foreign", result }
            : {
              type: "result",
              result: mutation === "corrupt"
                ? { url: input.url } as never
                : result,
            },
        );
        if (mutation === "duplicate") child.emit({ type: "result", result });
        if (mutation === "duplicate-error") child.emit({ type: "error" });
        child.controller.close();
        child.closed = true;
      }, 8);
    });
    const short = {
      ...input,
      options: { timeout: { open: 1, read: 1, info: 1 } },
    };
    await assertRejects(() => pool.check(short));
    await assertRejects(() => pool.check(short));
    await assertRejects(() => pool.check(input), Error, "failure limit");
    assertEquals(children.length, 2);
    await pool.close();
  }
});

Deno.test("url-only or missing requested check fields is infrastructure failure", async () => {
  for (const missing of ["all", "read", "info"] as const) {
    const { pool } = manager((child) => {
      child.accepted();
      const value: Record<string, unknown> = missing === "all"
        ? { url: input.url }
        : { ...result };
      delete value[missing];
      child.emit({ type: "result", result: value as never });
    });
    await assertRejects(() => pool.check(input));
    await pool.close();
  }
});

Deno.test("info-only result may omit automatic open but retains requested info", async () => {
  const { pool } = manager((child) => {
    child.accepted();
    const { open: _open, read: _read, ...infoOnly } = result;
    child.emit({ type: "result", result: infoOnly });
    child.controller.close();
    child.closed = true;
    child.resolveStatus({ code: 0, success: true });
  });
  const periodic: CheckRequest = {
    ...input,
    checks: ["info"],
    options: { timeout: 10000 },
    profile: "info-only",
  };
  const checked = await pool.check(periodic);
  assertEquals(checked.info, result.info);
  assertEquals(checked.open, undefined);
  await pool.close();
});

Deno.test("bounded admission rejects overflow and shutdown reaps admitted child", async () => {
  const { pool, children } = manager((child) => child.accepted());
  const first = pool.check(input);
  const second = pool.check(input);
  await assertRejects(() => pool.check(input), Error, "backpressure");
  const rejected = Promise.allSettled([first, second]);
  await pool.close();
  assertEquals((await rejected).map((x) => x.status), ["rejected", "rejected"]);
  assert(children[0].killed.length > 0);
  assertEquals(pool.snapshot().active, []);
});

Deno.test("captured request cannot mutate while queued", async () => {
  const request = structuredClone(input);
  const { pool, children } = manager();
  const work = pool.check(request);
  request.options.timeouts!.open = 1;
  await work;
  assertEquals(children[0].received?.options.timeouts?.open, 30000);
  await pool.close();
});

Deno.test("effective Worker plural timeout quirk keeps SDK defaults", () => {
  const d = checkDeadline(input);
  assertEquals(d.ms, 15000);
  assertEquals(d.orderedChecks, ["open", "read", "info"]);
  assertEquals(d.reason, "effective SDK timeout sum");
});

Deno.test("periodic numeric option remains absent SDK timer with separate declared IPC bound", () => {
  const request: CheckRequest = {
    ...input,
    checks: ["info"],
    options: { timeout: 10000, logLevel: "error" },
    profile: "info-only",
  };
  assertEquals(checkDeadline(request), {
    ms: 10000,
    orderedChecks: ["open", "info"],
    reason: "caller-declared numeric timeout; SDK timer absent",
  });
  assertEquals(request.options.timeout, 10000);
});

Deno.test("hostname launch inherits exact proxy policy with no main authority", () => {
  const cfg = {
    ...options,
    launch: {
      ...options.launch,
      mode: "proxychains" as const,
      proxychainsBinary: "/usr/bin/proxychains4",
      proxychainsConfig: "/etc/proxychains.conf",
    },
  };
  const plan = checkLaunchPlan(cfg, input, "generation", "request", {
    RELAYMON_MODE: "multinet",
    LD_PRELOAD: "/usr/lib/libproxychains.so.4",
    DENO_V8_FLAGS: "--max-old-space-size=128,--max-semi-space-size=8",
    RELAYMON_NSEC: "must-not-copy",
  });
  assertEquals(plan.command, "/usr/bin/proxychains4");
  assertEquals(plan.options.clearEnv, true);
  assertEquals(plan.options.env!.RELAYMON_NSEC, "");
  assertEquals(plan.options.env!.IP_API_KEY, "");
  assertEquals(plan.options.env!.RELAYMON_KUMA_PUSH_URL, "");
  const args = plan.options.args!;
  assert(args.includes("--allow-net=owned.invalid"));
  assert(args.includes("--cached-only"));
  assert(args.some((x) => x.endsWith("/checkTransportChild.ts")));
  assert(!args.some((x) => /--allow-(read|write|run|ffi)|--env-file/.test(x)));
  assert(!JSON.stringify(plan).includes("must-not-copy"));
  assert(!args.includes("--allow-all"));
});

Deno.test("process configuration cannot silently reduce normal queue concurrency", () => {
  const config = {
    queue: { workerConcurrency: 1 },
    relaymon: {
      checks: { enabled: ["open", "read", "info"], execution: options },
    },
  } as Config;
  validateCheckProcessConfig(config);
  assertThrows(() =>
    validateCheckProcessConfig(
      { ...config, queue: { workerConcurrency: 2 } } as Config,
    )
  );
  assertThrows(() => checkRequest({ ...input, checks: ["geo"] }));
  assertThrows(() => checkRequest({ ...input, checks: ["write"] }));
});

Deno.test("finite payload validation rejects cycles, non-finite values, and non-JSON objects", () => {
  assertThrows(() => finiteJson({ value: Infinity }));
  assertThrows(() => finiteJson(new Error("private")));
  const loop: Record<string, unknown> = {};
  loop.loop = loop;
  assertThrows(() => finiteJson(loop));
  finiteJson({ unknown: [null, true, "raw", { future: 1 }] });
});

Deno.test("bounded framing handles split lines and rejects truncation/oversize", async () => {
  const bytes = encodeCheckFrame({
    v: 1,
    generation: "g",
    request: "r",
    url: input.url,
    type: "ready",
  }, 1024);
  const frames: CheckFrame[] = [];
  await readCheckFrames(
    new ReadableStream({
      start(c) {
        c.enqueue(bytes.subarray(0, 3));
        c.enqueue(bytes.subarray(3));
        c.close();
      },
    }),
    1024,
    (frame) => {
      frames.push(frame);
    },
  );
  assertEquals(frames.length, 1);
  await assertRejects(() =>
    readCheckFrames(
      new ReadableStream({
        start(c) {
          c.enqueue(bytes.subarray(0, bytes.length - 1));
          c.close();
        },
      }),
      1024,
      () => {},
    )
  );
  await assertRejects(() =>
    readCheckFrames(
      new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(2048));
          c.close();
        },
      }),
      1024,
      () => {},
    )
  );
});

Deno.test("actual main check-only lifecycle owns shutdown but never a foreign PID file", async () => {
  const source = await Deno.readTextFile(
    new URL("../../src/core/main.ts", import.meta.url),
  );
  const cleanupLine = source.split("\n").find((line) =>
    line.includes("ownsPidFile") && line.includes("existsSync(PID_FILE)")
  )!;
  const expression = cleanupLine.slice(
    cleanupLine.indexOf("if (") + 4,
    cleanupLine.indexOf(" && existsSync"),
  );
  const ownsCleanup = new Function(
    "publication",
    "networkChecks",
    "ownsPidFile",
    `return ${expression};`,
  );
  assertEquals(ownsCleanup(undefined, {}, false), false);
  assertEquals(ownsCleanup({}, undefined, false), false);
  assertEquals(ownsCleanup(undefined, {}, true), true);
  assertEquals(ownsCleanup(undefined, undefined, false), true); // existing legacy behavior
  const shutdownGuards = source.split("\n").filter((line) =>
    line.includes("if (publication || networkChecks)") &&
    line.includes("shutdown(")
  );
  assertEquals(shutdownGuards.length, 2); // normal daemon return and initialization/execution rejection
});
