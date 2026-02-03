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
});

