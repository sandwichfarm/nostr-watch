/// <reference types="vite/types/importMeta.d.ts" />

import { isBrowser } from "@nostrwatch/utils";

import { AdapterCacheWorkerCommand, CacheAdapter, IAdapterCacheWorker, ICacheAdapter } from "@nostrwatch/nip66/core";
import { IEvent } from "@nostrwatch/nip66/models";

import { WorkerRelayInterface } from "@nostrwatch/worker-relay"
import { ReqCommand, ReqFilter } from "@nostrwatch/worker-relay/dist/types"; 
import { generateSubId, randomInRange } from "./utils";
import { NostrEvent } from "nostr-tools";

export interface INostrSqliteAdapter extends ICacheAdapter {
    REQ(filters: ReqFilter[]): Promise<IEvent[]>;
    COUNT(filters: ReqFilter[]): Promise<number>;
    DELETE(filters: ReqFilter[]): Promise<string[]>;
    DUMP(): Promise<Uint8Array>;
    CLOSE(subId: string): Promise<boolean>;
    WIPE(): Promise<boolean>;
}

export class NostrSqliteAdapter extends CacheAdapter implements INostrSqliteAdapter {
    private _relay?: WorkerRelayInterface;
    protected _ready: boolean = false;

    constructor(worker?: Worker | URL) {
        super(worker)
        // ////console.log('NostrSqliteAdapter constructor')
    }

    destroy(){
        if(this.relay.worker instanceof Worker){
            this.relay.worker.terminate()
        }
    }

    setup(){}

    /**
     * overload defaults with inop because WorkerRelayInterface handles it.
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

    async newWorker(): Promise<Worker | SharedWorker> {
        let worker;
        if(this.overloadWorker) {
            ////console.log(`NostrSqliteAdapter: using overloadWorker`)
            worker = this.overloadWorker
        }
        else if(import.meta.env.DEV) {
            ////console.log(`NostrSqliteAdapter: Instantiated new worker with URL in DEV mode`)
             /* @vite-ignore */
            worker = new Worker(new URL('./workers/nostrsqlite.worker.js', import.meta.url), { type: 'module' });
        } else {
            ////console.log(`NostrSqliteAdapter: Instantiated new worker with URL in PROD mode`)
            worker = new Worker(
                new URL("./workers/nostrsqlite.worker.js", import.meta.url),
                { type: 'module' }
            );
        }
        ////console.log('NostrSqliteAdapter: newWorker', worker)
        // if(!(worker instanceof Worker) && !(worker instanceof SharedWorker)) throw new Error('NostrSqliteAdapter: Worker is not a Worker or SharedWorker instance')
        if(worker instanceof SharedWorker) {
            worker.port.start()
        }
        this.relay = new WorkerRelayInterface(worker);
        this._ready = true
        return this.relay.worker; 
    }

    async ready(): Promise<void> {
        ////console.log('NostrSqlLite: awaiting ready')
        while(!this._ready) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        ////console.log('NostrSqlLite: ready')
    } 

    async addEvent(event: IEvent): Promise<void> {
        this.EVENT(event);
    }

    async addEvents(events: IEvent[]): Promise<void> {
        for(const event of events) {
            this.EVENT(event)
        }
    }

    async putEvent(event: IEvent): Promise<void> {
        this.addEvent(event)
    }

    async EVENT(event: IEvent): Promise<void> {
        await this.relay.event(event as unknown as NostrEvent)
    }

    async REQ(filters: ReqFilter[]): Promise<IEvent[]> {
        // ////console.log(filters)
        const message: ReqCommand = ['REQ', this.subId, ...filters];
        const promise = this.relay.query(message).catch(this.handleWorkerError.bind(this))
        let results = (await promise) as unknown as IEvent[]
        return results
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

    private handleWorkerError() {
        if(isBrowser()) {
            location.reload()
        }
    }
}