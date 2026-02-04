import { InMemoryRelay } from "./memory-relay";
import { setLogging } from "./debug";
import { installConsoleLogLevelFilter, normalizeLogLevel, setGlobalLogLevel } from "@nostrwatch/utils";

import {
    NostrEvent,
    ReqCommand,
    ReqFilter,
    RelayStorageStatus,
    WorkerMessage,
    unixNowMs,
    EventMetadata,
    OkResponse,
    RelayHandler,
  } from "./types";

import { getForYouFeed } from "./forYouFeed";

installConsoleLogLevelFilter();

const RELAY_INIT_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => Error): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(onTimeout()), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export interface InitAargs {
  databasePath: string;
  insertBatchSize?: number;
  channelPort?: MessagePort;
}

export interface WorkerState {
  self: DedicatedWorkerGlobalScope | SharedWorkerGlobalScope;
  relay: RelayHandler | undefined;
  eventWriteQueue: Array<NostrEvent>;
  messageChannel?: MessagePort;

  storageStatus?: RelayStorageStatus;

  insertBatchSize: number;
  insertBatchEvery: number;
  lastBatch: number;


}

export const defaultWorkerState = {
  self: self as DedicatedWorkerGlobalScope | SharedWorkerGlobalScope,
  relay: undefined,
  eventWriteQueue: [],
  insertBatchSize: 5,
  insertBatchEvery: 500,
  lastBatch: 0,
}

export async function insertBatch(state: WorkerState) {
  if (state.eventWriteQueue.length > 0) {
    const start = unixNowMs();
    const timeLimit = state.insertBatchEvery;
    if (state.relay) {
      while (state.eventWriteQueue.length > 0) {
        const totalEvents = state.eventWriteQueue.length;
        const hasRemainder = totalEvents % state.insertBatchSize > 0;
        const expired = unixNowMs() - state.lastBatch > state.insertBatchEvery;
        const expiredWithRemainder = expired && hasRemainder;
        if (unixNowMs() - start >= timeLimit) {
          break;
        }
        if(!expiredWithRemainder && totalEvents < state.insertBatchSize){
          break;
        }
        const batch = state.eventWriteQueue.splice(0, state.insertBatchSize);
        state.eventWriteQueue = state.eventWriteQueue.slice(batch.length);
        state.relay.eventBatch(batch);
        state.lastBatch = Date.now();
      }
    }
  }
  setTimeout(() => insertBatch(state), state.insertBatchEvery);
}

export const messageChannelInit = (state: WorkerState, channelPort: MessagePort) => {
  state.messageChannel = channelPort
}

let retries = 0;

export const relayInit = async (state: WorkerState, args: InitAargs) => {
  console.debug("[worker-relay] Relay init", args);
  state.insertBatchSize = args.insertBatchSize ?? 10;
  const opfsCapable =
    (globalThis as any).crossOriginIsolated === true &&
    typeof (globalThis as any).SharedArrayBuffer !== "undefined" &&
    typeof (globalThis as any).Atomics !== "undefined";
  try {
    if ("WebAssembly" in state.self && opfsCapable) {
      try {
        // Avoid eagerly importing sqlite-wasm in non-COOP/COEP contexts. Some browsers
        // will fail to load the module (or its WASM dependencies) before we can
        // fall back to memory storage.
        const { SqliteRelay } = await import("./sqlite/sqlite-relay");
        state.relay = new SqliteRelay();
        state.storageStatus = { kind: "sqlite" };
      } catch (e: any) {
        const message = e?.message ? String(e.message) : String(e);
        console.warn("OPFS/SQLite module failed to load, falling back to InMemoryRelay", e);
        state.relay = new InMemoryRelay();
        state.storageStatus = { kind: "memory", reason: "sqlite-import-failed", errorMessage: message };
      }
    } else {
      state.relay = new InMemoryRelay();
      state.storageStatus = opfsCapable
        ? { kind: "memory", reason: "no-wasm" }
        : {
            kind: "memory",
            reason: "opfs-unavailable",
            errorMessage: "Missing SharedArrayBuffer/Atomics (COOP/COEP required)",
          };
    }
    if(args.channelPort) {
      console.debug("[worker-relay] Channel port init");
      messageChannelInit(state, args.channelPort)
    }
    // await new Promise(resolve => setTimeout(resolve, 1000))
    const initPromise = Promise.resolve(state.relay.init(args.databasePath));
    // If `withTimeout` wins the race, the init promise can later reject; swallow it.
    void initPromise.catch(() => {});
    await withTimeout(initPromise, RELAY_INIT_TIMEOUT_MS, () => {
      const err = new Error(`Timed out waiting for relay init (${RELAY_INIT_TIMEOUT_MS}ms)`);
      (err as any).code = "OPFS_TIMEOUT";
      return err;
    });
    if (!state.storageStatus) {
      state.storageStatus = state.relay instanceof InMemoryRelay ? { kind: "memory" } : { kind: "sqlite" };
    }
  } catch (e: any) {
    const code = e.code || e.result?.code;
    const corrupt = code === "SQLITE_CORRUPT" || code === 11;
    const message = e.message || (e.result && e.result.message) || String(e);

    const opfsUnavailable =
      code === "OPFS_TIMEOUT" ||
      message.includes("OPFS") ||
      message.includes("SharedArrayBuffer") ||
      message.includes("crossOriginIsolated") ||
      message.includes("installOpfsSAHPoolVfs") ||
      message.includes("NoModificationAllowedError") ||
      message.includes("No modification allowed");

    if (opfsUnavailable) {
      console.warn("OPFS/SQLite unavailable, falling back to InMemoryRelay", e);
      try {
        state.relay?.close();
      } catch {}
      state.relay = new InMemoryRelay();
      state.storageStatus = {
        kind: "memory",
        reason: "opfs-unavailable",
        errorMessage: message,
      };
      await state.relay.init(args.databasePath);
      return;
    }

    if (corrupt || message.includes("malformed") || message.includes("not a database")) {
      try {
        await state.relay?.destroy();
      } catch (e) {
        console.warn("Failed to destroy relay", e);
      }
      await relayInit(state, args);
      return;
    } else {
      if(retries <= 5){
        state.relay?.close();
        if (retries === 0) {
          console.warn("Sqlite relay failed, retrying in 1 second", e);
        } else {
          console.debug("Sqlite relay failed, retrying in 1 second", e);
        }
        retries++
        await new Promise(resolve => setTimeout(resolve, 1000))
        await relayInit(state, args)
        return
      }
    }
    console.error("Fallback to InMemoryRelay", e);
    state.relay = new InMemoryRelay();
    state.storageStatus = { kind: "memory", reason: "error", errorMessage: message };
    await state.relay.init(args.databasePath);
  }
  
}

export const relayEvent = (state: WorkerState, ev: NostrEvent) => {
  state.eventWriteQueue.push(ev);
}

export const relayClose = (state: WorkerState) => {
  return state.relay?.close();
}

export const relayReq = (state: WorkerState, req: ReqCommand): (string | NostrEvent)[] => {
  const filters = req.slice(2) as Array<ReqFilter>;
  const results: Array<string | NostrEvent> = [];
  const ids = new Set<string>();
  for (const r of filters) {
    const rx = state.relay!.req(req[1], r);
    for (const x of rx) {
      if ((typeof x === "string" && ids.has(x)) || ids.has((x as NostrEvent).id)) {
        continue;
      }
      ids.add(typeof x === "string" ? x : (x as NostrEvent).id);
      results.push(x);
    }
  }
  return results;
}

export const relayCount = (state: WorkerState, req: ReqCommand): number => {
  let results = 0;
  const filters = req.slice(2) as Array<ReqFilter>;
  for (const r of filters) {
    const c = state.relay!.count(r);
    results += c;
  }
  return results;
}

export const relayDelete = (state: WorkerState, req: ReqCommand): string[] => {
  let results = [];
  const filters = req.slice(2) as Array<ReqFilter>;
  for (const r of filters) {
    const c = state.relay!.delete(r);
    results.push(...c);
  }
  return results
}

export const relayWipe = async (state: WorkerState) => {
  await state.relay!.wipe();
}

export const handleMsg = async (state: WorkerState, ev: MessageEvent, port?: MessagePort) => {
  async function reply<T>(id: string, obj?: T) {
    const _port = (port ?? state.self) as MessagePort | DedicatedWorkerGlobalScope | SharedWorkerGlobalScope;
    const message =  {
        id,
        cmd: "reply",
        args: obj,
      } as WorkerMessage<T>
    if(_port instanceof DedicatedWorkerGlobalScope){
      _port.postMessage(message);
    }
    // else if (_port instanceof SharedWorkerGlobalScope) {
    //   _port.port.postMessage(message);
    // }
    
  }

  const msg = ev.data as WorkerMessage<any>;
  try {
    switch (msg.cmd) {
      case "debug": {
        setLogging(true);
        setGlobalLogLevel("debug");
        installConsoleLogLevelFilter();
        reply(msg.id, true);
        break;
      }
      case "logLevel": {
        const nextLevel = normalizeLogLevel(msg.args, "warn");
        setGlobalLogLevel(nextLevel);
        installConsoleLogLevelFilter();
        reply(msg.id, true);
        break;
      }
      case "init": {
        const args = msg.args as InitAargs; 
        await relayInit(state, args)
        reply(msg.id, true);
        break;
      }
      case "status": {
        const status =
          state.storageStatus ??
          (state.relay instanceof InMemoryRelay
            ? ({ kind: "memory" } as RelayStorageStatus)
            : state.relay
              ? ({ kind: "sqlite" } as RelayStorageStatus)
              : ({ kind: "unknown", reason: "not-initialized" } as RelayStorageStatus));
        reply(msg.id, status);
        break;
      }
      case "event": {
        const ev = msg.args as NostrEvent;
        relayEvent(state, ev);
        reply(msg.id, {
          ok: true,
          id: ev.id,
          relay: "",
        } as OkResponse);
        break;
      }
      case "close": {
        const res = relayClose(state) //but this returns void?
        reply(msg.id, res);
        break;
      }
      case "req": {
        const req = msg.args as ReqCommand;
        const results = relayReq(state, req);
        reply(msg.id, results);
        break;
      }
      case "count": {
        const req = msg.args as ReqCommand;
        const results = relayCount(state, req);
        reply(msg.id, results);
        break;
      }
      case "delete": {
        const req = msg.args as ReqCommand;
        const results = relayDelete(state, req);
        reply(msg.id, results);
        break;
      }
      case "summary": {
        const res = state.relay!.summary();
        reply(msg.id, res);
        break;
      }
      case "dumpDb": {
        const res = await state.relay!.dump();
        reply(msg.id, res);
        break;
      }
      case "wipe": {
        await relayWipe(state);
        reply(msg.id, true);
        break;
      }
      case "forYouFeed": {
        const res = await getForYouFeed(state.relay!, msg.args as string);
        reply(msg.id, res);
        break;
      }
      case "setEventMetadata": {
        const [id, metadata] = msg.args as [string, EventMetadata];
        state.relay!.setEventMetadata(id, metadata);
        break;
      }
      case "upsertNip11": {
        const res = await state.relay!.upsertNip11(msg.args as any);
        reply(msg.id, res);
        break;
      }
      case "getNip11": {
        const res = await state.relay!.getNip11(msg.args as any);
        reply(msg.id, res);
        break;
      }
      case "countNip11s": {
        const res = await state.relay!.countNip11s();
        reply(msg.id, res);
        break;
      }
      case "countUniqueNip11s": {
        const res = await state.relay!.countUniqueNip11s();
        reply(msg.id, res);
        break;
      }
      case "dumpNip11s": {
        const res = await state.relay!.dumpNip11s();
        reply(msg.id, res);
        break;
      }
      case "batchUpsertNip11": {
        const res = await state.relay!.batchUpsertNip11(msg.args as any);
        reply(msg.id, res);
        break;
      }
      default: {
        reply(msg.id, { error: "Unknown command" });
        break;
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      reply(msg.id, { error: e.message });
    } else if (typeof e === "string") {
      reply(msg.id, { error: e });
    } else {
      reply(msg.id, "Unknown error");
    }
  }
};
