/// <reference types="vite/types/importMeta.d.ts" />

import { AdapterCacheWorker, AdapterCacheWorkerCommand, IAdapterCacheWorker } from "@nostrwatch/nip66/core";
import { IEvent } from "@nostrwatch/nip66/models";
//@ts-ignore: Vite worker import
import { NostrSqliteWorker } from "./NostrSqliteWorker?worker";
import { WorkerRelayInterface } from "@nostrwatch/worker-relay"
import { ReqCommand, ReqFilter } from "@nostrwatch/worker-relay/dist/types";
import { generateSubId, randomInRange } from "./utils";

export interface INostrSqliteAdapter extends IAdapterCacheWorker {
    REQ(filters: ReqFilter[]): Promise<IEvent[]>;
    COUNT(filters: ReqFilter[]): Promise<number>;
    DELETE(filters: ReqFilter[]): Promise<string[]>;
    DUMP(): Promise<Uint8Array>;
    CLOSE(subId: string): Promise<boolean>;
    WIPE(): Promise<boolean>;
}

export class NostrSqliteAdapter extends AdapterCacheWorker implements INostrSqliteAdapter {
    private _relay?: WorkerRelayInterface;
    private _ready: boolean = false;

    constructor() {
        super()
        console.log('NostrSqliteAdapter constructor')
    }

    destroy(){
        this.relay.worker.terminate()
    }

    /**
     * overload defaults because WorkerRelayInterface handles it.
    */
    bindWorkerHandlers() {}
    async onMessage(command: AdapterCacheWorkerCommand): Promise<void> { return void 0; }
    /** */

    private set relay(relay: WorkerRelayInterface) {
        this._relay = relay;
    }

    get relay(): WorkerRelayInterface {
        if(!this._relay) throw new Error('relay is not defined')
        return this._relay;
    }

    get subId(): string {
        return generateSubId(randomInRange(11, 24))
    }

    newWorker(): Worker {
        const worker: Worker | URL = import.meta.env.DEV
            ? new URL("@nostrwatch/nip66-cacheadapter-nostrsqlite/dist/nostrsqlite.worker.js", import.meta.url)
            : new NostrSqliteWorker();
        this.relay = new WorkerRelayInterface(worker);
        this._ready = true
        return this.relay.worker; 
    }
    
    async init(): Promise<void> {}

    async ready(): Promise<void> {
        while(!this._ready) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    async setup(command: any): Promise<void> {}

    async REQ(filters: ReqFilter[]): Promise<IEvent[]> {
        const message: ReqCommand = ['REQ', this.subId, ...filters];
        return (this.relay.query(message) as unknown as Promise<IEvent[]>);
    }

    async COUNT(filters: ReqFilter[]): Promise<number> {
        const message: ReqCommand = ['REQ', this.subId, ...filters];
        return this.relay.count(message);
    }

    async DELETE(filters: ReqFilter[]): Promise<string[]> {
        const message: ReqCommand = ['REQ', this.subId, ...filters];
        return this.relay.delete(message);
    }

    async DUMP(): Promise<Uint8Array> {
        return this.relay.dump();
    }

    async CLOSE(subId: string): Promise<boolean> {
        return this.relay.close(subId);
    }

    async WIPE(): Promise<boolean> {
        return this.relay.wipe();
    }
}