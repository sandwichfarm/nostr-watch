import {
  encodePublicationFrame,
  PUBLICATION_PROTOCOL,
  type PublicationFrame,
  readPublicationFrames,
} from "./publishTransportProtocol.ts";
export {
  encodePublicationFrame,
  PUBLICATION_PROTOCOL,
  readPublicationFrames,
} from "./publishTransportProtocol.ts";
export type { PublicationFrame } from "./publishTransportProtocol.ts";
import { Publisher, type PublisherFactory } from "@nostrwatch/publisher";
import { type Event as SignedEvent, utils } from "nostr-tools";
import {
  type Config,
  type PublicationProcessConfig,
  validatePublicationProcessConfig,
} from "../types/config.ts";

export const DEPLOYMENT_CREDENTIAL_NAMES = [
  "RELAYMON_NSEC",
  "IP_API_KEY",
  "RELAYMON_KUMA_PUSH_URL",
] as const;

export function canonicalPublicationRelays(relays: string[]): string[] {
  return [
    ...new Set(relays.map((relay) => {
      const url = new URL(relay);
      if (
        !["ws:", "wss:"].includes(url.protocol) || url.username ||
        url.password || url.hash
      ) {
        throw new Error(
          "Publication relay must be a credential-free WebSocket URL",
        );
      }
      return utils.normalizeURL(relay);
    })),
  ];
}

/** Mirror the effective destinations at the existing caller boundaries. */
export function effectivePublicationRelays(config: Config): string[] {
  const relays = [...config.publisher.relays];
  if (config.monitor?.info) {
    // maybeAnnounce sends the publisher+explicit metadata union to kind10166;
    // AnnounceMonitor's omitted metadata default is intentionally only two.
    relays.push(
      ...(config.announce?.userMetaRelays ??
        ["wss://purplepag.es", "wss://user.kindpag.es"]),
    );
  }
  if (config.relaymon.trustedRelayAssertions?.enabled) {
    relays.push(
      ...(config.relaymon.trustedRelayAssertions.relays?.length
        ? config.relaymon.trustedRelayAssertions.relays
        : config.publisher.relays),
    );
  }
  if (config.relaymon.ignorelist?.enabled) {
    relays.push(...config.relaymon.ignorelist.relays);
  }
  return canonicalPublicationRelays(relays);
}

export function publisherFactory(
  config: Config,
  context?: PublicationContext,
): PublisherFactory {
  if (
    config.publisher.transport !== undefined &&
    config.publisher.transport?.mode !== "per-relay-process"
  ) throw new Error("Unsupported publication transport mode");
  if (config.publisher.transport?.mode === "per-relay-process") {
    if (!context?.publisherFactory) {
      throw new Error(
        "per-relay-process publication requires its runtime context",
      );
    }
    return context.publisherFactory;
  }
  return (pubkey, relays) => new Publisher(pubkey, relays);
}

export interface PublicationChild {
  pid: number;
  stdin: WritableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
  status: Promise<{ code: number; success: boolean }>;
  kill(signal?: Deno.Signal): void;
}
export type PublicationLauncher = (
  relay: string,
  generation: string,
) => PublicationChild;

interface Attempt {
  frame: PublicationFrame;
  bytes: Uint8Array;
  resolve(value: unknown): void;
  reject(error: Error): void;
}
interface Generation {
  id: string;
  child: PublicationChild;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  state: "active" | "exit-draining" | "retired";
  ready: boolean;
  active?: Attempt;
  drain: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
  fault?: Error;
  killed?: boolean;
  exitCode?: number;
}
interface RelayOwner {
  relay: string;
  generation?: Generation;
  queue: Attempt[];
  starts: number;
  starting?: Promise<void>;
}

/** Runtime-owned; each relay has exactly one SDK owner and one active attempt.
 * The bounded queue is IPC backpressure only, and never replays a request. */
export class PublicationProcesses {
  private owners: Map<string, RelayOwner>;
  private stopping = false;
  private sequence = 0;
  private closing?: Promise<void>;
  private requests = new Set<Promise<unknown>>();
  private generations = new Set<Generation>();
  readonly outcomes = { forced: false, failures: 0, unexpectedExits: 0 };

  constructor(
    readonly relays: string[],
    readonly options: PublicationProcessConfig,
    private launch: PublicationLauncher,
  ) {
    this.owners = new Map(
      relays.map((relay) => [relay, { relay, queue: [], starts: 0 }]),
    );
  }

  async start(): Promise<void> {
    // Sequential cached startup bounds the import/heap peak. No relay connects
    // before a signed event is admitted.
    for (const owner of this.owners.values()) await this.startOwner(owner);
  }

  private startOwner(owner: RelayOwner): Promise<void> {
    if (owner.starting) return owner.starting;
    const starting = this.spawnOwner(owner).finally(() => {
      if (owner.starting === starting) owner.starting = undefined;
    });
    owner.starting = starting;
    return starting;
  }

  private async spawnOwner(owner: RelayOwner): Promise<void> {
    if (owner.generation && owner.generation.state !== "retired") {
      await owner.generation.drain;
    }
    if (owner.generation?.state === "active") return;
    if (this.stopping) throw new Error("Publication transport is closing");
    if (owner.starts >= this.options.maxRestarts + 1) {
      throw new Error("Publication child restart limit reached");
    }
    const id = `${++owner.starts}-${crypto.randomUUID()}`;
    const child = this.launch(owner.relay, id);
    let readyResolve!: () => void;
    let readyReject!: (e: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const generation: Generation = {
      id,
      child,
      writer: child.stdin.getWriter(),
      state: "active",
      ready: false,
      drain: Promise.resolve(),
    };
    owner.generation = generation;
    this.generations.add(generation);
    const startupTimer = setTimeout(() => {
      generation.fault = new Error("Publication child startup deadline");
      this.force(generation);
    }, this.options.shutdownMs);
    generation.drain = readPublicationFrames(
      child.stdout,
      this.options.maxFrameBytes,
      (frame) => {
        if (
          frame.v !== PUBLICATION_PROTOCOL || frame.generation !== id ||
          frame.relay !== owner.relay
        ) {
          throw new Error("Publication response identity mismatch");
        }
        if (frame.type === "ready" && !generation.ready && !frame.request) {
          generation.ready = true;
          clearTimeout(startupTimer);
          readyResolve();
          return;
        }
        const attempt = generation.active;
        if (
          !attempt || frame.request !== attempt.frame.request ||
          frame.eventId !== attempt.frame.eventId
        ) {
          throw new Error("Unmatched publication response");
        }
        if (frame.type !== "ack" && frame.type !== "error") {
          throw new Error(
            "Invalid publication response",
          );
        }
        if (
          frame.type === "ack" &&
          (typeof frame.ackAt !== "number" || !Number.isFinite(frame.ackAt))
        ) {
          throw new Error("Invalid ACK response");
        }
        generation.active = undefined;
        if (
          frame.type === "ack" && typeof frame.ackAt === "number" &&
          Number.isFinite(frame.ackAt)
        ) {
          attempt.resolve({
            ackAt: frame.ackAt,
            observedAt: Date.now(),
            pid: child.pid,
          });
        } else {
          attempt.reject(
            new Error(
              frame.type === "error"
                ? "Relay rejected publication"
                : "Invalid ACK response",
            ),
          );
        }
        // Dispatch only after the current pipe chunk has been decoded. This also
        // prevents a trailing duplicate ACK from being matched to the next event.
        queueMicrotask(() => this.dispatch(owner));
      },
    ).catch((error) => {
      generation.fault = error instanceof Error
        ? error
        : new Error(String(error));
      this.force(generation);
    }).finally(async () => {
      clearTimeout(startupTimer);
      generation.state = "exit-draining";
      this.armDrain(generation);
      try {
        await generation.writer.close();
      } catch { /* exit may close stdin */ }
      await child.status.catch(() => ({ code: -1, success: false }));
      clearTimeout(generation.timer);
      // This is after every complete frame preceding EOF. A valid ACK already
      // resolved once and is never overwritten by status, partial data or kill.
      generation.active?.reject(
        generation.fault ??
          new Error("Publication outcome uncertain after child exit"),
      );
      generation.active = undefined;
      readyReject(
        generation.fault ??
          new Error("Publication child exited before readiness"),
      );
      generation.state = "retired";
      generation.writer.releaseLock();
      this.generations.delete(generation);
      const waiting = owner.queue.splice(0);
      for (const attempt of waiting) {
        if (attempt.frame.generation === id) {
          attempt.reject(
            new Error("Publication generation exited before dispatch"),
          );
        } else owner.queue.push(attempt);
      }
    });
    // A status notification is diagnostic and fences dispatch; the reader still
    // owns the old generation and drains its complete ACKs before retirement.
    void child.status.then((status) => {
      generation.exitCode = status.code;
      if (generation.state === "active") this.outcomes.unexpectedExits++;
      if (generation.state === "retired") return;
      generation.state = "exit-draining";
      this.armDrain(generation);
    }, () => {
      generation.state = "exit-draining";
      this.armDrain(generation);
    });
    await ready;
  }

  private armDrain(generation: Generation): void {
    generation.timer ??= setTimeout(
      () => this.force(generation),
      this.options.shutdownMs,
    );
  }
  private force(generation: Generation): void {
    if (generation.state === "retired" || generation.killed) return;
    generation.killed = true;
    this.outcomes.forced = true;
    generation.state = "exit-draining";
    // Killing the sole child closes its pipe. The reader then classifies bytes
    // already buffered in order; this is not a publication/ACK timeout.
    try {
      generation.child.kill("SIGKILL");
    } catch { /* already exited */ }
  }

  publish(relay: string, event: SignedEvent): Promise<unknown> {
    if (this.stopping) {
      return Promise.reject(new Error("Publication transport is closing"));
    }
    const owner = this.owners.get(relay);
    if (!owner) {
      return Promise.reject(
        new Error("Publication relay is outside the configured union"),
      );
    }
    if (
      !event || typeof event.id !== "string" ||
      !/^[a-f0-9]{64}$/.test(event.id) || typeof event.sig !== "string"
    ) {
      return Promise.reject(
        new Error("Publication transport accepts signed events only"),
      );
    }
    if (
      owner.queue.length + (owner.generation?.active ? 1 : 0) >=
        this.options.maxPendingPerRelay
    ) {
      return Promise.reject(
        new Error("Publication IPC backpressure limit reached"),
      );
    }
    let bytes: Uint8Array;
    const frame: PublicationFrame = {
      v: PUBLICATION_PROTOCOL,
      type: "publish",
      relay,
      generation: owner.generation?.state === "active"
        ? owner.generation.id
        : "",
      request: String(++this.sequence),
      eventId: event.id,
      event: {
        id: event.id,
        sig: event.sig,
        pubkey: event.pubkey,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        created_at: event.created_at,
      },
    };
    try {
      bytes = encodePublicationFrame(frame, this.options.maxFrameBytes);
    } catch (error) {
      return Promise.reject(error);
    }
    const request = new Promise<unknown>((resolve, reject) => {
      owner.queue.push({
        frame: JSON.parse(new TextDecoder().decode(bytes)),
        bytes,
        resolve,
        reject,
      });
    });
    this.requests.add(request);
    request.then(() => this.requests.delete(request), () => {
      this.requests.delete(request);
      this.outcomes.failures++;
    });
    const generation = owner.generation;
    if (!generation || generation.state !== "active") {
      // Reconnect only for newly admitted work, never replay the old attempt.
      void this.startOwner(owner).then(() => this.dispatch(owner), (error) => {
        for (const attempt of owner.queue.splice(0)) attempt.reject(error);
      });
    } else this.dispatch(owner);
    return request;
  }

  private dispatch(owner: RelayOwner): void {
    const generation = owner.generation;
    if (
      !generation || generation.state !== "active" || !generation.ready ||
      generation.active
    ) return;
    const attempt = owner.queue.shift();
    if (!attempt) return;
    attempt.frame.generation = generation.id;
    try {
      attempt.bytes = encodePublicationFrame(
        attempt.frame,
        this.options.maxFrameBytes,
      );
    } catch (error) {
      attempt.reject(error instanceof Error ? error : new Error(String(error)));
      queueMicrotask(() => this.dispatch(owner));
      return;
    }
    generation.active = attempt;
    void generation.writer.write(attempt.bytes).catch((error) => {
      generation.fault = new Error(
        `Publication IPC write failed: ${String(error)}`,
      );
      generation.state = "exit-draining";
      this.force(generation);
    });
  }

  snapshot() {
    return [...this.owners.values()].map((owner) => ({
      relay: owner.relay,
      pid: owner.generation?.child.pid,
      generation: owner.generation?.id,
      state: owner.generation?.state,
      exitCode: owner.generation?.exitCode,
      pending: owner.queue.length + (owner.generation?.active ? 1 : 0),
    }));
  }

  close(): Promise<void> {
    return this.closing ??= (async () => {
      this.stopping = true;
      const deadline = setTimeout(() => {
        for (const owner of this.owners.values()) {
          for (const attempt of owner.queue.splice(0)) {
            attempt.reject(new Error("Publication shutdown before dispatch"));
          }
        }
        for (const generation of this.generations) this.force(generation);
      }, this.options.shutdownMs);
      try {
        await Promise.allSettled([...this.requests]);
        for (const generation of this.generations) {
          if (generation.state !== "active") {
            this.armDrain(generation);
            continue;
          }
          generation.state = "exit-draining";
          try {
            await generation.writer.write(
              encodePublicationFrame({
                v: PUBLICATION_PROTOCOL,
                type: "close",
                generation: generation.id,
                relay: this.relays.find((r) =>
                  this.owners.get(r)?.generation === generation
                )!,
              }, this.options.maxFrameBytes),
            );
            await generation.writer.close();
          } catch {
            this.force(generation);
          }
        }
        await Promise.all([...this.generations].map((g) => g.drain));
      } finally {
        clearTimeout(deadline);
      }
    })();
  }
}

/** Explicit child policy; no parent CLI or full environment is copied. */
export function publicationLaunchPlan(
  options: PublicationProcessConfig,
  relay: string,
  generation: string,
  inherited: Record<string, string | undefined> = {
    DENO_DIR: Deno.env.get("DENO_DIR"),
    DENO_CERT: Deno.env.get("DENO_CERT"),
    DENO_TLS_CA_STORE: Deno.env.get("DENO_TLS_CA_STORE"),
    LD_PRELOAD: Deno.env.get("LD_PRELOAD"),
    RELAYMON_MODE: Deno.env.get("RELAYMON_MODE"),
    PROXYCHAINS_CONF_FILE: Deno.env.get("PROXYCHAINS_CONF_FILE"),
    ...Object.fromEntries(
      [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "no_proxy",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
        "NODE_OPTIONS",
        "DENO_FLAGS",
        "DENO_OPTIONS",
        "DENO_V8_FLAGS",
      ].map((name) => [name, Deno.env.get(name)]),
    ),
  },
) {
  const launch = options.launch;
  if (
    launch.mode === "direct" &&
    /\.(onion|i2p|loki)$/.test(new URL(relay).hostname)
  ) {
    throw new Error(
      "Anonymous publication destination requires proxychains policy",
    );
  }
  for (
    const name of [
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "NO_PROXY",
      "http_proxy",
      "https_proxy",
      "all_proxy",
      "no_proxy",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR",
      "NODE_OPTIONS",
      "DENO_FLAGS",
      "DENO_OPTIONS",
      "DENO_V8_FLAGS",
    ]
  ) {
    if (inherited[name]) {
      throw new Error(
        `Unsupported inherited publication runtime policy: ${name}`,
      );
    }
  }
  const proxied = inherited.RELAYMON_MODE === "multinet" ||
    /proxychains/.test(inherited.LD_PRELOAD ?? "");
  if (proxied && launch.mode !== "proxychains") {
    throw new Error("Proxied parent requires proxied publication children");
  }
  if (
    inherited.LD_PRELOAD &&
    !/^\/[^ :]*libproxychains[^ :]*$/.test(inherited.LD_PRELOAD)
  ) {
    throw new Error("Unsupported publication preload policy");
  }
  if (
    inherited.PROXYCHAINS_CONF_FILE &&
    inherited.PROXYCHAINS_CONF_FILE !== launch.proxychainsConfig
  ) {
    throw new Error("Publication proxy configuration conflicts with parent");
  }
  if (
    inherited.DENO_CERT && launch.certFile &&
    inherited.DENO_CERT !== launch.certFile
  ) throw new Error("Publication certificate policy conflicts with parent");
  if (
    inherited.DENO_TLS_CA_STORE && launch.caStores &&
    inherited.DENO_TLS_CA_STORE !== launch.caStores
  ) throw new Error("Publication CA store policy conflicts with parent");
  const env: Record<string, string> = Object.fromEntries(
    DEPLOYMENT_CREDENTIAL_NAMES.map((name) => [name, ""]),
  );
  const cache = launch.cacheDir ?? inherited.DENO_DIR;
  const cert = launch.certFile ?? inherited.DENO_CERT;
  const stores = launch.caStores ?? inherited.DENO_TLS_CA_STORE;
  if (cache) env.DENO_DIR = cache;
  if (stores) env.DENO_TLS_CA_STORE = stores;
  const config = new URL("../../deno.json", import.meta.url).pathname;
  const child = new URL("./publishTransportChild.ts", import.meta.url).pathname;
  const args = [
    "run",
    "--cached-only",
    "--no-lock",
    "--no-check",
    "--unstable-sloppy-imports",
    `--config=${config}`,
    `--v8-flags=--max-old-space-size=${launch.oldSpaceMb},--max-semi-space-size=${launch.semiSpaceMb}`,
    `--allow-net=${new URL(relay).host}`,
    "--no-prompt",
  ];
  if (cert) args.push(`--cert=${cert}`);
  args.push(child, relay, generation, String(options.maxFrameBytes));
  let command = Deno.execPath();
  if (launch.mode === "proxychains") {
    if (
      !launch.proxychainsBinary?.startsWith("/") ||
      !launch.proxychainsConfig?.startsWith("/")
    ) {
      throw new Error(
        "Publication proxy launch needs explicit absolute binary/config paths",
      );
    }
    args.unshift("-f", launch.proxychainsConfig, command);
    command = launch.proxychainsBinary;
  }
  return {
    command,
    options: {
      args,
      clearEnv: true,
      env,
      stdin: "piped",
      stdout: "piped",
      stderr: "inherit",
    } as Deno.CommandOptions,
  };
}

export class PublicationContext {
  readonly signal: AbortSignal;
  private abort = new AbortController();
  private stopCallbacks: Array<() => void> = [];
  private drainCallbacks: Array<() => Promise<void>> = [];
  private publishers = new Set<Publisher>();
  private closing?: Promise<void>;
  private closed = false;
  private stopFailure?: unknown;
  constructor(readonly processes: PublicationProcesses) {
    this.signal = this.abort.signal;
  }
  get stopping(): boolean {
    return this.signal.aborted;
  }
  readonly publisherFactory: PublisherFactory = (pubkey, relays) => {
    if (this.closed) throw new Error("Publication context is closed");
    for (const relay of canonicalPublicationRelays(relays)) {
      if (!this.processes.relays.includes(relay)) {
        throw new Error("Publisher outside configured publication union");
      }
    }
    const publisher = new Publisher(pubkey, relays, {
      transport: {
        publish: (relay, event) => this.processes.publish(relay, event),
        release: () => {
          this.publishers.delete(publisher);
        },
      },
    });
    this.publishers.add(publisher);
    return publisher;
  };
  onStop(callback: () => void): void {
    if (this.stopping) {
      try {
        callback();
      } catch (error) {
        this.stopFailure ??= error;
      }
    } else this.stopCallbacks.push(callback);
  }
  onDrain(callback: () => Promise<void>): void {
    this.drainCallbacks.push(callback);
  }
  stop(): void {
    if (this.stopping) return;
    this.abort.abort();
    for (const callback of this.stopCallbacks.splice(0)) {
      try {
        callback();
      } catch (error) {
        this.stopFailure ??= error;
      }
    }
  }
  close(): Promise<void> {
    return this.closing ??= (async () => {
      this.stop();
      // Admitted check work may still enqueue its publication during drain.
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const expired = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => {
          this.closed = true;
          reject(
            new Error("Publication producer drain exceeded shutdown bound"),
          );
        }, this.processes.options.shutdownMs);
      });
      const drain = (async () => {
        for (const callback of this.drainCallbacks) await callback();
        this.closed = true;
        await Promise.all(
          [...this.publishers].map((publisher) => publisher.close()),
        );
      })();
      let failure: unknown = this.stopFailure;
      try {
        await Promise.race([drain, expired]);
      } catch (error) {
        failure = error;
      } finally {
        clearTimeout(deadline);
      }
      this.closed = true;
      if (failure) {
        // Rejection/force cannot erase a complete ACK already in a child pipe.
        // Manager close owns pipe decoding and child status/reaping first.
        await this.processes.close();
        await Promise.allSettled(
          [...this.publishers].map((publisher) => publisher.close()),
        );
        throw failure;
      }
      await this.processes.close();
      if (this.processes.outcomes.forced) {
        throw new Error(
          "Publication shutdown required forced termination; unresolved work remains unacknowledged",
        );
      }
    })();
  }
}

export async function createPublicationContext(
  config: Config,
  launcher?: PublicationLauncher,
  onCreated?: (context: PublicationContext) => void,
): Promise<PublicationContext | undefined> {
  if (
    config.publisher.transport !== undefined &&
    config.publisher.transport?.mode !== "per-relay-process"
  ) throw new Error("Unsupported publication transport mode");
  if (config.publisher.transport?.mode !== "per-relay-process") {
    return undefined;
  }
  const options = config.publisher.transport;
  validatePublicationProcessConfig(options);
  const relays = effectivePublicationRelays(config);
  const expected = canonicalPublicationRelays(options.expectedRelays);
  if (
    relays.length !== expected.length ||
    relays.some((relay) => !expected.includes(relay))
  ) {
    throw new Error(
      "Effective publication union differs from the explicitly qualified relay set",
    );
  }
  if (!relays.length || relays.length > options.maxChildren) {
    throw new Error("Publication child cardinality exceeds configured bounds");
  }
  // Validate every launch policy before spawning the first child.
  if (!launcher) {
    for (const relay of relays) {
      publicationLaunchPlan(options, relay, "validation");
    }
  }
  const processes = new PublicationProcesses(
    relays,
    options,
    launcher ?? ((relay, generation) => {
      const plan = publicationLaunchPlan(options, relay, generation);
      return new Deno.Command(plan.command, plan.options).spawn();
    }),
  );
  const context = new PublicationContext(processes);
  try {
    onCreated?.(context);
    await processes.start();
    return context;
  } catch (error) {
    await processes.close();
    throw error;
  }
}

/** PID-independent signal ownership, installed before the first child starts. */
export function installPublicationSignals(
  context: PublicationContext,
  terminate: (signal: string) => void,
  signals: Pick<typeof Deno, "addSignalListener" | "removeSignalListener"> =
    Deno,
): () => void {
  const handlers = (["SIGINT", "SIGTERM"] as const).map((signal) => {
    const handler = () => {
      context.stop();
      terminate(signal);
    };
    signals.addSignalListener(signal, handler);
    return { signal, handler };
  });
  return () => {
    for (const { signal, handler } of handlers) {
      signals.removeSignalListener(signal, handler);
    }
  };
}
