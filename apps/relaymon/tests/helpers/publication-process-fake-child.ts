// No network sockets: exercise the real cached SDK's NOTICE/OK handling against
// a deterministic WebSocket fixture inside an otherwise restricted subprocess.
class FixtureSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  onopen?: (event: object) => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: object) => void;
  onerror?: (event: object) => void;
  constructor(_url: string) {
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.({});
    });
  }
  send(value: string): void {
    const [type, event] = JSON.parse(value);
    if (type !== "EVENT") throw new Error("Unexpected fixture request");
    queueMicrotask(() => {
      this.onmessage?.({
        data: JSON.stringify(["NOTICE", "fixture diagnostic"]),
      });
      this.onmessage?.({
        data: JSON.stringify(["OK", event.id, true, "fixture ACK"]),
      });
    });
  }
  close(): void {
    this.readyState = 3;
    this.onclose?.({});
  }
}
globalThis.WebSocket = FixtureSocket as unknown as typeof WebSocket;
const { runPublicationChild } = await import(
  "../../src/utils/publishTransportChild.ts"
);
await runPublicationChild(Deno.args[0], Deno.args[1], Number(Deno.args[2]));
