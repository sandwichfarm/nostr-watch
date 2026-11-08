const encoder = new TextEncoder();
export const PUBLICATION_PROTOCOL = 1;

export interface PublicationFrame {
  v: number;
  generation: string;
  relay: string;
  request?: string;
  eventId?: string;
  type: "ready" | "publish" | "ack" | "error" | "close";
  event?: unknown;
  error?: string;
  ackAt?: number;
}

export function encodePublicationFrame(
  frame: PublicationFrame,
  maxBytes: number,
): Uint8Array {
  const bytes = encoder.encode(JSON.stringify(frame) + "\n");
  if (bytes.byteLength > maxBytes) {
    throw new Error("Publication frame exceeds byte limit");
  }
  return bytes;
}

/** One bounded decoder owns EOF classification. Status never rejects requests. */
export async function readPublicationFrames(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  onFrame: (frame: PublicationFrame) => void | Promise<void>,
): Promise<void> {
  const reader = stream.getReader();
  let buffered = new Uint8Array(0);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      // Parse incrementally so many complete small frames in one pipe chunk do
      // not require an unbounded retained buffer or trip the per-frame bound.
      let start = 0;
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== 10) continue;
        const segment = value.subarray(start, i);
        if (buffered.length + segment.length + 1 > maxBytes) {
          throw new Error("Oversized publication response");
        }
        const line = new Uint8Array(buffered.length + segment.length);
        line.set(buffered);
        line.set(segment, buffered.length);
        buffered = new Uint8Array(0);
        const handling = onFrame(
          JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(line)),
        );
        if (handling) await handling;
        start = i + 1;
      }
      const remainder = value.subarray(start);
      if (buffered.length + remainder.length + 1 > maxBytes) {
        throw new Error("Oversized publication response");
      }
      if (remainder.length) {
        const next = new Uint8Array(buffered.length + remainder.length);
        next.set(buffered);
        next.set(remainder, buffered.length);
        buffered = next;
      }
    }
    if (buffered.length) throw new Error("Truncated publication response");
  } finally {
    reader.releaseLock();
  }
}
