import { EventMetadata, NostrEvent, OkResponse, ReqCommand, RelayStorageStatus, WorkerMessage, WorkerMessageCommand } from "./types";
import { v4 as uuid } from "uuid";
import type { LogLevel } from "@nostrwatch/utils";

export interface InitAargs {
  /**
   * OPFS file path for the database
   */
  databasePath: string;

  /**
   * How many events to insert per batch
   */
  insertBatchSize?: number;
}

export interface Nip11Args {
  relay: string;
  nip11: any;
}

export type batchNip11s = Nip11Args[];

export class WorkerRelayInterface {
  #worker: Worker | SharedWorker;
  #commandQueue: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      timeoutId?: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  #channelPort?: MessagePort; 

  // Command timeout
  timeout: number = 30_000;

  /**
   * Interface wrapper for worker relay
   * @param scriptPath Path to worker script or Worker script object
   */
  constructor(scriptPath?: string | URL | Worker | SharedWorker, channelPort?: MessagePort) {
    if (scriptPath instanceof Worker || scriptPath instanceof SharedWorker) {
      this.#worker = scriptPath;
    } else {
      const sp = scriptPath ? scriptPath : new URL("@nostrwatch/worker-relay/dist/esm/worker.mjs", import.meta.url);
      this.#worker = new Worker(sp, { type: "module" });
    }
    this.#worker.onerror = e => {
      console.error(e.message, e);
      this.#failAll(new Error(e.message));
    };
    if(this.#worker instanceof Worker) {
      this.#worker.onmessageerror = e => {
        console.error(e);
        this.#failAll(new Error("Worker message error"));
      };
    }

    const onmessage = (e: MessageEvent) => {
      const cmd = e.data as WorkerMessage<any>;
      if (cmd.cmd === "reply") {
        const entry = this.#commandQueue.get(cmd.id);
        if (!entry) return;
        this.#commandQueue.delete(cmd.id);
        if (entry.timeoutId) clearTimeout(entry.timeoutId);
        const payload: any = cmd.args;
        if (payload && typeof payload === "object" && "error" in payload && payload.error) {
          entry.reject(payload.error);
          return;
        }
        entry.resolve(payload);
      }
    };

    if(this.#worker instanceof Worker) {
      this.#worker.onmessage = onmessage; 
    }
    else if(this.#worker instanceof SharedWorker) {
      this.#worker.port.onmessage = onmessage;
    }

    this.#channelPort = channelPort;
  }

  get worker() {
    return this.#worker;
  }

  async setup(opts?: { timeoutMs?: number }) {
    // alert(this.#channelPort? 'channelPort exists' : 'channelPort does not exist');
    if(!this.#channelPort) return;
    const channelPort = this.#channelPort;
    // if(this.#worker instanceof Worker) {
    //   this.#worker.postMessage({ type: "setup", channelPort }, [channelPort]);
    // }
    // else if(this.#worker instanceof SharedWorker) {
    //   this.#worker.port.postMessage({ type: "setup", channelPort }, [channelPort]);
    // }
    return await this.#workerRpc<any, boolean>("setup", { type: "setup", channelPort }, [channelPort], opts);
  }

  async init(args: InitAargs) {
    return await this.#workerRpc<InitAargs, boolean>("init", args);
  }

  async status() {
    return await this.#workerRpc<void, RelayStorageStatus>("status");
  }

  async countNip11s() {
    return await this.#workerRpc<void, number>("countNip11s");
  }

  async countUniqueNip11s() {
    return await this.#workerRpc<void, number>("countUniqueNip11s");
  }

  async dumpNip11s() {
    return await this.#workerRpc<void, any[]>("dumpNip11s");
  }

  async batchUpsertNip11(relayNip11s: batchNip11s) {
    return await this.#workerRpc<batchNip11s, boolean>("batchUpsertNip11", relayNip11s);
  }

  async upsertNip11(nip11Args: Nip11Args) {
    return await this.#workerRpc<Nip11Args, boolean>("upsertNip11", nip11Args);
  }

  async getNip11(relay: string) {
    return await this.#workerRpc<string, any>("getNip11", relay);
  }

  async event(ev: NostrEvent) {
    return await this.#workerRpc<NostrEvent, OkResponse>("event", ev);
  }

  async query(req: ReqCommand) {
    return await this.#workerRpc<ReqCommand, Array<NostrEvent>>("req", req);
  }

  async count(req: ReqCommand) {
    return await this.#workerRpc<ReqCommand, number>("count", req);
  }

  async delete(req: ReqCommand) {
    return await this.#workerRpc<ReqCommand, Array<string>>("delete", req);
  }

  async summary() {
    return await this.#workerRpc<void, Record<string, number>>("summary");
  }

  async close(id: string) {
    return await this.#workerRpc<string, boolean>("close", id);
  }

  async dump() {
    return await this.#workerRpc<void, Uint8Array>("dumpDb");
  }

  async wipe() {
    return await this.#workerRpc<void, boolean>("wipe");
  }

  async forYouFeed(pubkey: string) {
    return await this.#workerRpc<string, Array<NostrEvent>>("forYouFeed", pubkey);
  }

  setEventMetadata(id: string, meta: EventMetadata) {
    return this.#workerRpc<[string, EventMetadata], void>("setEventMetadata", [id, meta]);
  }

  async debug(v: string) {
    return await this.#workerRpc<string, boolean>("debug", v);
  }

  async setLogLevel(level: LogLevel) {
    return await this.#workerRpc<LogLevel, boolean>("logLevel", level);
  }

  abort() {
    this.#failAll(new Error("Aborted"));
    this.#commandQueue.clear();
    if(this.#worker instanceof Worker) {
      this.#worker.terminate();
    }
    else if(this.#worker instanceof SharedWorker) {
      this.#worker.port.close();
    }
  }

  #failAll(reason: unknown) {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    for (const [, entry] of this.#commandQueue.entries()) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      try {
        entry.reject(err);
      } catch {}
    }
    this.#commandQueue.clear();
  }

  async #workerRpc<T, R>(cmd: WorkerMessageCommand, args?: T, transfer?: Transferable[], opts?: { timeoutMs?: number }) {
    const id = uuid();
    const msg = {
      id,
      cmd,
      args,
    } as WorkerMessage<T>;
    return await new Promise<R>((resolve, reject) => {
      const timeoutMs = opts?.timeoutMs ?? this.timeout;
      if(this.#worker instanceof Worker) {
        this.#worker.postMessage(msg, transfer || []);
      }
      else if(this.#worker instanceof SharedWorker) {
        this.#worker.port.postMessage(msg, transfer || []);
      }
      const t = setTimeout(() => {
        this.#commandQueue.delete(id);
        reject(new Error("Timeout"));
      }, timeoutMs);
      this.#commandQueue.set(id, { resolve: resolve as any, reject, timeoutId: t });
    });
  }
}
