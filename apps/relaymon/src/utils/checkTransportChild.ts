import {
  CHECK_PROTOCOL,
  checkDeadline,
  type CheckRequest,
  checkRequest,
  encodeCheckFrame,
  readCheckFrames,
} from "./checkTransportProtocol.ts";

export function effectiveCheckDeadline(nocap: {
  checksRequested: string[];
  evaluate_requested_checks(): void;
  config: { timeout: unknown };
}, input: CheckRequest): ReturnType<typeof checkDeadline> {
  nocap.checksRequested = [...input.checks];
  nocap.evaluate_requested_checks();
  const expected = checkDeadline(input);
  if (
    JSON.stringify(nocap.checksRequested) !==
      JSON.stringify(expected.orderedChecks)
  ) throw new Error("NoCap dependency/order changed");
  const sdkValues = nocap.checksRequested.map((key) =>
    (nocap.config.timeout as Record<string, number>)?.[key]
  );
  if (typeof nocap.config.timeout === "number") {
    if (
      sdkValues.some((value) => value !== undefined) ||
      expected.ms !== nocap.config.timeout
    ) throw new Error("Numeric NoCap timeout behavior changed");
  } else if (sdkValues.reduce((sum, value) => sum + value, 0) !== expected.ms) {
    throw new Error("NoCap timeout defaults changed");
  }
  return expected;
}

/** Exact pre-existing NoCap construction/adapter profiles, with no app imports. */
export async function performNetworkCheck(
  input: CheckRequest,
  accepted?: (deadline: ReturnType<typeof checkDeadline>) => Promise<void>,
) {
  const { Nocap } = await import("@nostrwatch/nocap");
  const nocap = new Nocap(input.url, input.options);
  if (input.profile === "info-only") {
    const Info =
      (await import("@nostrwatch/nocap-info-adapter-default")).default;
    await nocap.useAdapters([Info]);
  } else {
    const Every =
      (await import("@nostrwatch/nocap-every-adapter-default")).default;
    await nocap.useAdapters(Object.values(Every));
  }
  // Match actual SDK dependency/order; numeric timeout has no SDK timer.
  // Do not fix Worker plural `timeouts` or periodic singular numeric `timeout`.
  if (accepted) {
    await accepted(effectiveCheckDeadline(nocap, input));
  }
  return await nocap.check(
    (accepted ? [...input.checks] : input.checks) as Parameters<
      typeof nocap.check
    >[0],
  );
}

export async function runCheckChild(
  generation: string,
  request: string,
  url: string,
  maxBytes: number,
  channel = {
    input: Deno.stdin.readable,
    output: Deno.stdout.writable,
    perform: performNetworkCheck,
  },
): Promise<void> {
  const diagnostic = console.error.bind(console);
  console.log =
    console.info =
    console.debug =
    console.warn =
    console.error =
      () => diagnostic("Network check diagnostic");
  const writer = channel.output.getWriter();
  const base = { v: CHECK_PROTOCOL, generation, request, url };
  let called = false, terminal = false;
  let operation: Promise<void> | undefined;
  try {
    await writer.write(encodeCheckFrame({ ...base, type: "ready" }, maxBytes));
    await readCheckFrames(channel.input, maxBytes, (frame) => {
      if (
        called || frame.v !== CHECK_PROTOCOL ||
        frame.generation !== generation || frame.request !== request ||
        frame.url !== url || frame.type !== "check" || frame.input?.url !== url
      ) throw new Error("Invalid check request identity");
      const input = frame.input;
      called = true;
      // Keep reading the parent channel while NoCap is pending. A numeric SDK
      // timeout has no timer of its own; stdin owns this worker until the parent
      // supplies EOF after a terminal frame, or cancels/reaps the process.
      operation = (async () => {
        try {
          checkRequest(input);
          const result = await channel.perform(
            input,
            async (deadline) => {
              await writer.write(
                encodeCheckFrame(
                  {
                    ...base,
                    type: "accepted",
                    deadlineMs: deadline.ms,
                    deadlineReason: deadline.reason,
                    orderedChecks: deadline.orderedChecks,
                  },
                  maxBytes,
                ),
              );
            },
          );
          terminal = true;
          await writer.write(
            encodeCheckFrame({ ...base, type: "result", result }, maxBytes),
          );
        } catch {
          terminal = true;
          await writer.write(
            encodeCheckFrame({ ...base, type: "error" }, maxBytes),
          );
        }
      })();
      // Observe channel failures even if a parent disappears before completion.
      void operation.catch(() => {});
    });
    if (!called) throw new Error("Missing check request");
    if (!terminal) throw new Error("Parent closed before check completion");
    await operation;
  } finally {
    try {
      await writer.close();
    } finally {
      writer.releaseLock();
    }
  }
}

if (import.meta.main) {
  try {
    const [generation, request, url, max] = Deno.args;
    await runCheckChild(generation, request, url, Number(max));
    // One request per hostname-scoped process. Stdout has been fully flushed;
    // SDK background handles cannot retain the slot after a completed frame.
    Deno.exit(0);
  } catch {
    console.error("Network check child channel failed");
    // A disconnected parent cannot retain an unbounded SDK operation owner.
    Deno.exit(1);
  }
}
