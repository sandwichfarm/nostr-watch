import { SqliteRelay } from "./sqlite/sqlite-relay";
import { InMemoryRelay } from "./memory-relay";
import { setLogging } from "./debug";

import {
    NostrEvent,
    ReqCommand,
    ReqFilter,
    WorkerMessage,
    unixNowMs,
    EventMetadata,
    OkResponse,
    RelayHandler,
  } from "./types";

import { getForYouFeed } from "./forYouFeed";

let processed = 0

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

  insertBatchSize: number;
  insertBatchEvery: number;
  lastBatch: number;
}

export const defaultWorkerState = {
  self: self as DedicatedWorkerGlobalScope | SharedWorkerGlobalScope,
  relay: undefined,
  eventWriteQueue: [],
  insertBatchSize: 10,
  insertBatchEvery: 1000,
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
        // console.log("batches processed:", processed);
        processed++
      }
    }
  }
  setTimeout(() => insertBatch(state), 100);
}

export const messageChannelInit = (state: WorkerState, channelPort: MessagePort) => {
  state.messageChannel = channelPort
}

export const relayInit = async (state: WorkerState, args: InitAargs) => {
  console.log("Relay init", args)
  state.insertBatchSize = args.insertBatchSize ?? 10;
  try {
    if ("WebAssembly" in state.self) {
      state.relay = new SqliteRelay();
    } else {
      state.relay = new InMemoryRelay();
    }
    if(args.channelPort) {
      console.log("Channel port init")
      messageChannelInit(state, args.channelPort)
    }
    await state.relay.init(args.databasePath);
  } catch (e) {
    console.error("Fallback to InMemoryRelay", e);
    state.relay = new InMemoryRelay();
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
    else if (_port instanceof SharedWorkerGlobalScope) {
      _port.port.postMessage(message);
    }
    
  }

  const msg = ev.data as WorkerMessage<any>;
  try {
    switch (msg.cmd) {
      case "debug": {
        setLogging(true);
        reply(msg.id, true);
        break;
      }
      case "init": {
        const args = msg.args as InitAargs; 
        await relayInit(state, args)
        reply(msg.id, true);
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