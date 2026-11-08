import {
  type PublicationChild,
  publicationLaunchPlan,
} from "./publishTransport.ts";
import {
  type CheckProcessConfig,
  type Config,
  validateCheckProcessConfig,
} from "../types/config.ts";
import type { NocapCheckResult } from "../types/relay.ts";
import {
  CHECK_PROTOCOL,
  checkDeadline,
  type CheckFrame,
  type CheckProfile,
  type CheckRequest,
  checkRequest,
  encodeCheckFrame,
  readCheckFrames,
  validateCheckResult,
} from "./checkTransportProtocol.ts";

export type CheckLauncher = (
  input: CheckRequest,
  generation: string,
  request: string,
) => PublicationChild;
interface Job {
  input: CheckRequest;
  resolve(result: NocapCheckResult): void;
  reject(error: Error): void;
}

/** A bounded admission pool of hostname-restricted, one-request processes.
 * Periodic NIP-11 work shares these slots instead of creating an ad-hoc owner.
 * Queue concurrency is unchanged; IPC backpressure never drops/replays a job. */
export class CheckProcesses {
  private queue: Job[] = [];
  private active = new Set<PublicationChild>();
  private identities = new Map<
    PublicationChild,
    { generation: string; request: string; url: string }
  >();
  private requests = new Set<Promise<unknown>>();
  private unexpectedFailures = 0;
  private abort = new AbortController();
  private closing?: Promise<void>;
  private parentDrain?: () => Promise<void>;
  readonly outcomes = { failures: 0, forced: false };
  get signal(): AbortSignal {
    return this.abort.signal;
  }
  get stopping(): boolean {
    return this.signal.aborted;
  }

  constructor(
    readonly options: CheckProcessConfig,
    private launch: CheckLauncher,
  ) {}

  setParentDrain(drain: () => Promise<void>): void {
    this.parentDrain = drain;
  }
  snapshot() {
    return {
      stopping: this.stopping,
      pending: this.queue.length,
      active: [...this.identities].map(([child, identity]) => ({
        pid: child.pid,
        ...identity,
      })),
      failures: this.outcomes.failures,
      consecutiveUnexpectedFailures: this.unexpectedFailures,
    };
  }

  check(input: CheckRequest): Promise<NocapCheckResult> {
    checkRequest(input);
    checkDeadline(input);
    const captured = structuredClone(input);
    encodeCheckFrame({
      v: CHECK_PROTOCOL,
      generation: "admission",
      request: "admission",
      url: captured.url,
      type: "check",
      input: captured,
    }, this.options.maxFrameBytes);
    if (this.stopping) {
      return Promise.reject(new Error("Network checks are closing"));
    }
    if (this.queue.length >= this.options.maxPending) {
      return Promise.reject(new Error("Check IPC backpressure limit reached"));
    }
    const result = new Promise<NocapCheckResult>((resolve, reject) =>
      this.queue.push({ input: captured, resolve, reject })
    );
    this.requests.add(result);
    void result.finally(() => this.requests.delete(result)).catch(() => {});
    this.dispatch();
    return result;
  }

  private dispatch(): void {
    while (
      !this.stopping && this.queue.length &&
      this.active.size < this.options.maxChildren
    ) {
      const job = this.queue.shift()!;
      if (this.unexpectedFailures > this.options.maxRestarts) {
        job.reject(new Error("Check child failure limit reached"));
        continue;
      }
      void this.run(job).catch((e) =>
        job.reject(e instanceof Error ? e : new Error("Check child failed"))
      );
    }
  }

  private force(child: PublicationChild): void {
    this.outcomes.forced = true;
    try {
      child.kill("SIGKILL");
    } catch { /* already reaped */ }
  }

  private async run(job: Job): Promise<void> {
    const generation = crypto.randomUUID(), request = crypto.randomUUID();
    let child: PublicationChild;
    try {
      child = this.launch(job.input, generation, request);
    } catch {
      this.unexpectedFailures++;
      this.outcomes.failures++;
      job.reject(new Error("Check child launch failed"));
      queueMicrotask(() => this.dispatch());
      return;
    }
    this.active.add(child);
    this.identities.set(child, { generation, request, url: job.input.url });
    const writer = child.stdin.getWriter();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fault: Error | undefined,
      protocolFault: Error | undefined,
      candidate: NocapCheckResult | undefined;
    let ready = false,
      accepted = false,
      operationExpired = false,
      startupExpired = false,
      operationFailed = false,
      lateResult = false,
      statusUnavailable = false,
      drainExpired = false,
      inputClosed = false,
      inputCloseFailed = false,
      statusSucceeded = false;
    const closeInput = async () => {
      if (inputClosed) return;
      inputClosed = true;
      try {
        await writer.close();
      } catch {
        inputCloseFailed = true;
        fault ??= new Error("Check child input close failed");
      }
    };
    const expire = (
      message: string,
      ms: number,
      phase: "startup" | "operation" | "drain",
    ) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fault = new Error(message);
        if (phase === "operation" && !candidate) operationExpired = true;
        if (phase === "startup" && !accepted) startupExpired = true;
        if (phase === "drain") drainExpired = true;
        this.force(child);
      }, ms);
    };
    expire("Check child startup deadline", this.options.shutdownMs, "startup");
    const base = { v: CHECK_PROTOCOL, generation, request, url: job.input.url };
    const expectedDeadline = checkDeadline(job.input);
    const drain = readCheckFrames(
      child.stdout,
      this.options.maxFrameBytes,
      async (frame: CheckFrame) => {
        if (
          frame.v !== CHECK_PROTOCOL || frame.generation !== generation ||
          frame.request !== request || frame.url !== job.input.url
        ) {
          throw new Error("Check response identity mismatch");
        }
        if (frame.type === "ready" && !ready) {
          ready = true;
          await writer.write(
            encodeCheckFrame(
              { ...base, type: "check", input: job.input },
              this.options.maxFrameBytes,
            ),
          );
          return;
        }
        if (
          frame.type === "accepted" && ready && !accepted && !candidate &&
          !startupExpired &&
          frame.deadlineMs === expectedDeadline.ms &&
          frame.deadlineReason === expectedDeadline.reason &&
          JSON.stringify(frame.orderedChecks) ===
            JSON.stringify(expectedDeadline.orderedChecks)
        ) {
          accepted = true;
          expire(
            "Network check exceeded IPC deadline",
            frame.deadlineMs!,
            "operation",
          );
          return;
        }
        if (
          frame.type === "error" && accepted && !candidate &&
          !operationFailed && !lateResult
        ) {
          operationFailed = true;
          fault ??= new Error("Network check child operation failed");
          expire(
            "Check child error drain deadline",
            this.options.shutdownMs,
            "drain",
          );
          await closeInput();
          return;
        }
        if (
          operationExpired && frame.type === "result" && accepted &&
          !lateResult && !operationFailed
        ) {
          // A valid buffered completion cannot rescue an expired operation,
          // but neither does it turn the owned cancellation into a worker fault.
          validateCheckResult(job.input, frame.result);
          lateResult = true;
          await closeInput();
          return;
        }
        if (
          frame.type !== "result" || !accepted || candidate ||
          operationExpired || operationFailed
        ) {
          throw new Error("Invalid or duplicate check result");
        }
        validateCheckResult(job.input, frame.result);
        candidate = frame.result;
        // Keep the completed frame, but require EOF and process reaping before
        // returning its result or reusing this slot. No status-before-pipe race.
        expire(
          "Check child result drain deadline",
          this.options.shutdownMs,
          "drain",
        );
        await closeInput();
      },
    ).catch((e) => {
      protocolFault ??= e instanceof Error ? e : new Error("Check IPC failed");
      this.force(child);
    });
    let rejection: Error | undefined;
    try {
      const statusPromise = child.status.catch(() => {
        statusUnavailable = true;
        fault ??= new Error("Check child status unavailable");
        this.force(child);
        return { code: -1, success: false };
      });
      const [status] = await Promise.all([statusPromise, drain]);
      statusSucceeded = status.success;
      if (protocolFault || !candidate) {
        throw protocolFault ?? fault ??
          new Error("Check child exited without a complete result");
      }
      if (fault || !status.success) {
        this.unexpectedFailures++;
        this.outcomes.failures++;
      } else {
        // Only a complete, valid response with clean EOF and reap restores
        // worker confidence. Known operation failures do not reset this streak.
        this.unexpectedFailures = 0;
      }
    } catch (error) {
      if (
        protocolFault || statusUnavailable || drainExpired ||
        (inputCloseFailed && !operationExpired) ||
        (operationFailed && !operationExpired && !statusSucceeded &&
          !this.stopping) ||
        (!operationExpired && !operationFailed && !this.stopping)
      ) {
        this.unexpectedFailures++;
      }
      this.outcomes.failures++;
      rejection = error instanceof Error
        ? error
        : new Error("Check child failed");
    } finally {
      clearTimeout(timer);
      await closeInput();
      writer.releaseLock();
      this.active.delete(child);
      this.identities.delete(child);
      queueMicrotask(() => this.dispatch());
    }
    if (rejection) job.reject(rejection);
    else job.resolve(candidate!);
  }

  stop(): void {
    if (this.stopping) return;
    this.abort.abort();
    for (const job of this.queue.splice(0)) {
      job.reject(new Error("Network check shutdown before admission"));
    }
    for (const child of this.active) {
      try {
        child.kill("SIGTERM");
      } catch { /* already exited */ }
    }
  }

  close(): Promise<void> {
    return this.closing ??= (async () => {
      this.stop();
      const timer = setTimeout(() => {
        for (const child of this.active) this.force(child);
      }, this.options.shutdownMs);
      try {
        await Promise.allSettled([...this.requests]);
        await this.parentDrain?.();
      } finally {
        clearTimeout(timer);
      }
    })();
  }
}

export function checkLaunchPlan(
  options: CheckProcessConfig,
  input: CheckRequest,
  generation: string,
  request: string,
  inherited?: Parameters<typeof publicationLaunchPlan>[3],
) {
  checkRequest(input);
  const plan = publicationLaunchPlan(
    {
      mode: "per-relay-process",
      expectedRelays: [],
      maxChildren: options.maxChildren,
      maxPendingPerRelay: options.maxPending,
      maxFrameBytes: options.maxFrameBytes,
      maxRestarts: options.maxRestarts,
      shutdownMs: options.shutdownMs,
      launch: options.launch,
    },
    input.url,
    generation,
    inherited,
  );
  const args = [...plan.options.args!];
  const old = new URL("./publishTransportChild.ts", import.meta.url).pathname;
  const index = args.indexOf(old);
  if (index < 0) throw new Error("Publication launch policy changed");
  // Same target hostname only, including its normal HTTP/WebSocket ports.
  args[args.findIndex((x) => x.startsWith("--allow-net="))] = `--allow-net=${
    new URL(input.url).hostname
  }`;
  args.splice(
    index,
    4,
    new URL("./checkTransportChild.ts", import.meta.url).pathname,
    generation,
    request,
    input.url,
    String(options.maxFrameBytes),
  );
  // Environment is clear and contains only declared policy plus three blanks.
  // No application environment file is loaded by a check child.
  args.splice(index, 0, "--allow-env");
  return { command: plan.command, options: { ...plan.options, args } };
}

export function createCheckTransport(
  config: Config,
  launcher?: CheckLauncher,
): CheckProcesses | undefined {
  const options = config.relaymon.checks.execution;
  if (options === undefined) return undefined;
  validateCheckProcessConfig(config);
  return new CheckProcesses(
    options,
    launcher ?? ((input, generation, request) => {
      const plan = checkLaunchPlan(options, input, generation, request);
      return new Deno.Command(plan.command, plan.options).spawn();
    }),
  );
}

export async function checkNetwork(
  url: string,
  checks: string[],
  options: CheckRequest["options"],
  profile: CheckProfile = "default",
  transport?: CheckProcesses,
): Promise<NocapCheckResult> {
  const input: CheckRequest = { url, checks, options, profile };
  if (transport) return await transport.check(input);
  // Existing deployments keep the original in-process behavior; NoCap runtime
  // imports remain lazy so isolated parents do not retain its module heap.
  const { performNetworkCheck } = await import("./checkTransportChild.ts");
  return await performNetworkCheck(input);
}
