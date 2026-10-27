import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UniversalWebSocket } from "../../../websocket/src/index";

class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  url: string;
  sent: unknown[] = [];

  constructor(url: string) {
    super();
    this.url = url;
    MockWebSocket.instances.push(this);

    queueMicrotask(() => {
      if (this.readyState !== MockWebSocket.CONNECTING) return;
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }

  send(data: unknown): void {
    this.sent.push(data);
  }

  close(code = 1000, reason = ""): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    try {
      this.dispatchEvent(new CloseEvent("close", { code, reason }));
    } catch {
      const ev = new Event("close") as any;
      ev.code = code;
      ev.reason = reason;
      this.dispatchEvent(ev);
    }
  }

  terminate(): void {
    this.close(1006, "terminated");
  }

  emitMessage(data: unknown): void {
    try {
      this.dispatchEvent(new MessageEvent("message", { data }));
    } catch {
      const ev = new Event("message") as any;
      ev.data = data;
      this.dispatchEvent(ev);
    }
  }
}

describe("UniversalWebSocket", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances.length = 0;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("connects and emits open", async () => {
    const ws = new UniversalWebSocket("wss://example.com", [], { autoConnect: false, connectTimeout: 50 });
    const onOpen = vi.fn();

    ws.on("open", onOpen);

    const ok = await ws.connect();

    expect(ok).toBe(true);
    expect(ws.CONNECTED).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("sends arrays as JSON strings", async () => {
    const ws = new UniversalWebSocket("wss://example.com", [], { autoConnect: false, connectTimeout: 50 });
    await ws.connect();

    ws.send(["REQ", "subid", { limit: 1 }]);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.sent[0]).toBe('[\"REQ\",\"subid\",{\"limit\":1}]');
  });

  it("delivers message events and supports off()", async () => {
    const ws = new UniversalWebSocket("wss://example.com", [], { autoConnect: false, connectTimeout: 50 });
    await ws.connect();

    const onMessage = vi.fn();
    ws.on("message", onMessage);

    MockWebSocket.instances[0]?.emitMessage("hello");
    expect(onMessage).toHaveBeenCalledTimes(1);

    ws.off("message", onMessage);
    MockWebSocket.instances[0]?.emitMessage("world");
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("forks a separate lazy connection without sharing listeners", async () => {
    const parent = new UniversalWebSocket("wss://example.com/relay", ["nostr"], { autoConnect: false, connectTimeout: 50 });
    const listener = vi.fn();
    parent.on("message", listener);
    const child = parent.fork("wss://example.com/relay/child");
    expect(MockWebSocket.instances).toHaveLength(0);
    expect(child.url).toBe("wss://example.com/relay/child");
    await parent.connect();
    await child.connect();
    MockWebSocket.instances[1].emitMessage("child only");
    expect(listener).not.toHaveBeenCalled();
    expect(parent.CONNECTED).toBe(true);
    child.terminate();
    expect(parent.CONNECTED).toBe(true);
    expect(parent.fork().url).toBe("wss://example.com/relay");
    parent.terminate();
  });

  it("preserves proxy and transport configuration when forking", () => {
    const agent = { proxy: "tor" };
    const wsOptions = { headers: { "x-test": "auditor" }, handshakeTimeout: 30 };
    const parent = new UniversalWebSocket("wss://example.com", ["nostr"], { agent, wsOptions, connectTimeout: 75, autoConnect: false });
    const child = parent.fork();
    expect((child as any).protocols).toEqual(["nostr"]);
    expect((child as any).options).toEqual({ agent, wsOptions, connectTimeout: 75, autoConnect: false });
    expect((child as any).options.wsOptions).not.toBe(wsOptions);
    expect((child as any).options.agent).toBe(agent);
  });
});

