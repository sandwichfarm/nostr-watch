import { EventMetadata, NostrEvent, OkResponse, ReqCommand, WorkerMessage, WorkerMessageCommand } from "./types";
import { v4 as uuid } from "uuid";

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
  #commandQueue: Map<string, (v: unknown, ports: ReadonlyArray<MessagePort>) => void> = new Map();

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
    };
    if(this.#worker instanceof Worker) {
      this.#worker.onmessageerror = e => {
        console.error(e);
      };
    }

    const onmessage = (e: MessageEvent) => {
      const cmd = e.data as WorkerMessage<any>;
      if (cmd.cmd === "reply") {
        const q = this.#commandQueue.get(cmd.id);
        q?.(cmd, e.ports);
        this.#commandQueue.delete(cmd.id);
      }
    };
    if(this.#worker instanceof Worker) {
      this.#worker.onmessage = onmessage; 
    }
    else if(this.#worker instanceof SharedWorker) {
      this.#worker.port.onmessage = onmessage;
    }
    if(channelPort) {
      if(this.#worker instanceof Worker) {
        this.#worker.postMessage({ type: "setup", channelPort }, [channelPort]);
      }
      else if(this.#worker instanceof SharedWorker) {
        this.#worker.port.postMessage({ type: "setup", channelPort }, [channelPort]);
      }
    }
  }

  get worker() {
    return this.#worker;
  }

  async init(args: InitAargs) {
    return await this.#workerRpc<InitAargs, boolean>("init", args);
  }

  async countNip11s() {
    return await this.#workerRpc<void, number>("countNip11s");
  }

  async countUniqueNip11s() {
    return await this.#workerRpc<void, number>("countUniqueNip11s");
  }

  async dumpNip11s() {
    return await this.#workerRpc<void, Uint8Array>("dumpNip11s");
  }

  async batchUpsertNip11(relayNip11s: batchNip11s) {
    return await this.#workerRpc<batchNip11s, boolean>("batchUpsertNip11", relayNip11s);
  }

  async upsertNip11(nip11Args: Nip11Args) {
    return await this.#workerRpc<Nip11Args, OkResponse>("upsertNip11", nip11Args);
  }

  async getNip11(relay: string) {
    return await this.#workerRpc<string, OkResponse>("getNip11", relay);
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

  async #workerRpc<T, R>(cmd: WorkerMessageCommand, args?: T) {
    const id = uuid();
    const msg = {
      id,
      cmd,
      args,
    } as WorkerMessage<T>;
    return await new Promise<R>((resolve, reject) => {
      if(this.#worker instanceof Worker) {
        this.#worker.postMessage(msg);
      }
      else if(this.#worker instanceof SharedWorker) {
        this.#worker.port.postMessage(msg);
      }
      const t = setTimeout(() => {
        this.#commandQueue.delete(id);
        reject(new Error("Timeout"));
      }, this.timeout);
      this.#commandQueue.set(id, (v, port) => {
        clearTimeout(t);
        const cmdReply = v as WorkerMessage<R & { error?: any }>;
        if (cmdReply.args.error) {
          reject(cmdReply.args.error);
          return;
        }
        resolve(cmdReply.args);
      });
    });
  }
}
