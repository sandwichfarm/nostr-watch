import { SimplePool, utils } from "nostr-tools";
import { verifyEvent } from "nostr-tools/pure";
import {
  encodePublicationFrame,
  PUBLICATION_PROTOCOL,
  type PublicationFrame,
  readPublicationFrames,
} from "./publishTransportProtocol.ts";

/** A child has no signer, app config, DB, producer, second relay, or retries. */
export async function runPublicationChild(
  relay: string,
  generation: string,
  maxFrameBytes: number,
): Promise<void> {
  if (
    utils.normalizeURL(relay) !== relay || !Number.isInteger(maxFrameBytes) ||
    maxFrameBytes < 1024 || maxFrameBytes > 1048576
  ) {
    throw new Error("Invalid publication child binding");
  }
  // SDK default NOTICE handlers use console.debug. Never let remote diagnostics
  // enter the NDJSON pipe or echo remote/event payloads into application logs.
  const diagnostic = console.error.bind(console);
  console.log =
    console.info =
    console.debug =
    console.warn =
    console.error =
      () => diagnostic("Publication SDK diagnostic");
  // All SDK modules are imported before readiness. One persistent pool, with
  // exactly one active ensureRelay/publish operation, retains SDK deadlines.
  const pool = new SimplePool();
  const writer = Deno.stdout.writable.getWriter();
  let active: Promise<void> | undefined;
  let closing = false;
  const write = (frame: PublicationFrame) =>
    writer.write(encodePublicationFrame(frame, maxFrameBytes));
  const base = { v: PUBLICATION_PROTOCOL, generation, relay };
  try {
    await write({ ...base, type: "ready" });
    await readPublicationFrames(
      Deno.stdin.readable,
      maxFrameBytes,
      async (frame) => {
        if (
          frame.v !== PUBLICATION_PROTOCOL || frame.generation !== generation ||
          frame.relay !== relay || closing
        ) {
          throw new Error("Invalid publication request identity");
        }
        if (frame.type === "close" && !active) {
          closing = true;
          return;
        }
        if (
          frame.type !== "publish" || active || !frame.request || !frame.eventId
        ) throw new Error("Concurrent or invalid publication request");
        const event = frame.event as Parameters<typeof verifyEvent>[0];
        if (
          !event || event.id !== frame.eventId || !verifyEvent(event)
        ) throw new Error("Child requires a valid signed event");
        const identity = {
          ...base,
          request: frame.request,
          eventId: frame.eventId,
        };
        active = (async () => {
          let response: PublicationFrame;
          try {
            const connectionTimeout = "maxWaitForConnection" in pool
              ? pool.maxWaitForConnection as number
              : undefined;
            const connection = await pool.ensureRelay(relay, {
              connectionTimeout,
            });
            await connection.publish(event);
            response = { ...identity, type: "ack", ackAt: Date.now() };
          } catch {
            // Do not place relay messages/event contents into the IPC error.
            response = { ...identity, type: "error" };
          }
          await write(response);
        })().finally(() => {
          active = undefined;
        });
        // Observe stdout failure without creating an unhandled rejection. The
        // failed channel exits nonzero; it never causes replay in this process.
        await active;
      },
    );
    await active;
  } finally {
    pool.close([relay]);
    try {
      await writer.close();
    } finally {
      writer.releaseLock();
    }
  }
}

if (import.meta.main) {
  const [relay, generation, bound] = Deno.args;
  try {
    await runPublicationChild(relay, generation, Number(bound));
  } catch {
    console.error("Publication child channel failed");
    Deno.exitCode = 1;
  }
}
