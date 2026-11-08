// deno-lint-ignore-file no-import-prefix -- Reuse the existing versioned offline assertion fixture.
import { assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { Nocap } from "@nostrwatch/nocap";
import Every from "@nostrwatch/nocap-every-adapter-default";
import WebsocketAdapter from "@nostrwatch/nocap-websocket-adapter-default";
import InfoAdapter from "@nostrwatch/nocap-info-adapter-default";
import {
  effectiveCheckDeadline,
  performNetworkCheck,
} from "../../src/utils/checkTransportChild.ts";
import type { CheckRequest } from "../../src/utils/checkTransportProtocol.ts";

const input: CheckRequest = {
  url: "ws://owned.invalid/",
  checks: ["open", "read", "info"],
  options: { timeouts: { open: 30000, read: 1000 }, logLevel: "error" },
  profile: "default",
};

Deno.test("real NoCap constructor preserves plural timeout defaults and exact SDK deadline", () => {
  const nocap = new Nocap(input.url, input.options);
  assertEquals(nocap.config.timeout.open, 5000);
  assertEquals(nocap.config.timeout.read, 5000);
  assertEquals(effectiveCheckDeadline(nocap, input), {
    ms: 15000,
    orderedChecks: ["open", "read", "info"],
    reason: "effective SDK timeout sum",
  });
});

Deno.test("real periodic numeric constructor has NO SDK DeferredWrapper timer", () => {
  const periodic: CheckRequest = {
    ...input,
    checks: ["info"],
    options: { timeout: 10000, logLevel: "error" },
    profile: "info-only",
  };
  const nocap = new Nocap(input.url, periodic.options);
  assertEquals(nocap.config.timeout, 10000);
  let timers = 0;
  const original = nocap.timeouts.create;
  nocap.timeouts.create = () => {
    timers++;
  };
  try {
    nocap.promises.add(
      "info",
      (nocap.config.timeout as unknown as Record<string, number>).info,
      () => {},
    );
    assertEquals(timers, 0);
    assertEquals(effectiveCheckDeadline(nocap, periodic), {
      ms: 10000,
      orderedChecks: ["open", "info"],
      reason: "caller-declared numeric timeout; SDK timer absent",
    });
  } finally {
    nocap.timeouts.create = original;
  }
});

Deno.test("real NoCap/adapters network-transport spies retain result parity without sockets", async () => {
  const original = {
    open: WebsocketAdapter.prototype.check_open,
    read: WebsocketAdapter.prototype.check_read,
    info: InfoAdapter.prototype.check_info,
  };
  WebsocketAdapter.prototype.check_open = async function () {
    this.base.ws = {
      readyState: 1,
      terminate() {
        this.readyState = 3;
      },
    } as never;
    await this.base.finish("open", {
      data: true,
      duration: 1,
      status: "success",
    });
  };
  WebsocketAdapter.prototype.check_read = async function () {
    await this.base.finish("read", {
      data: false,
      duration: 1,
      status: "error",
      message: "Not NIP-01 compatible",
    });
  };
  InfoAdapter.prototype.check_info = async function () {
    await this.base.finish("info", {
      data: { name: "owned", future_field: { list: [1, "preserve"] } },
      duration: 1,
      status: "success",
    });
  };
  try {
    const baseline = new Nocap(input.url, input.options);
    await baseline.useAdapters(Object.values(Every));
    const before = await baseline.check(
      [...input.checks] as Parameters<typeof baseline.check>[0],
    );
    let deadline = 0;
    const isolated = await performNetworkCheck(input, (value) => {
      deadline = value.ms;
      return Promise.resolve();
    });
    assertEquals(deadline, 15000);
    for (const key of ["url", "network"] as const) {
      assertEquals(isolated[key], before[key]);
    }
    for (const key of ["open", "read", "info"] as const) {
      assertEquals(isolated[key].data, before[key].data);
      assertEquals(isolated[key].status, before[key].status);
      assertEquals(isolated[key].message, before[key].message);
    }
    assertEquals(isolated.read.message, "Not NIP-01 compatible");
    assertEquals(isolated.info.data.future_field, { list: [1, "preserve"] });
  } finally {
    WebsocketAdapter.prototype.check_open = original.open;
    WebsocketAdapter.prototype.check_read = original.read;
    InfoAdapter.prototype.check_info = original.info;
  }
});
