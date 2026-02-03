/// <reference types="vite/types/importMeta.d.ts" />

import { delay, getGlobalLogLevel, isBrowser, normalizeLogLevel, type LogLevel } from "@nostrwatch/utils";

import { AdapterCacheWorkerCommand, CacheAdapter, IAdapterCacheWorker, ICacheAdapter } from "@nostrwatch/route66/core";
import { IEvent } from "@nostrwatch/route66/models";

import { WorkerRelayInterface } from "@nostrwatch/worker-relay"
import { OkResponse, ReqCommand, ReqFilter } from "@nostrwatch/worker-relay/dist/types"; 
import { generateSubId, randomInRange } from "./utils";
import { NostrEvent } from "nostr-tools";

import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 10 });

export interface INostrSqliteAdapter extends ICacheAdapter {
    REQ(filters: ReqFilter[]): Promise<IEvent[]>;
    COUNT(filters: ReqFilter[]): Promise<number>;
    DELETE(filters: ReqFilter[]): Promise<string[]>;
    DUMP(): Promise<Uint8Array>;
    CLOSE(subId: string): Promise<boolean>;
    WIPE(): Promise<boolean>;

    upsertNip11(relay: string, nip11: any): Promise<boolean>;
    batchUpsertNip11(relayNip11s: {relay: string, nip11: any}[]): Promise<boolean>;
    countNip11s(): Promise<number>;
    countUniqueNip11s(): Promise<number>;
    dumpNip11s(): Promise<any[]>;

    getNip11(relay: string): Promise<any>;
}

export class NostrSqliteAdapter extends CacheAdapter implements INostrSqliteAdapter {
    private _relay?: WorkerRelayInterface;
    protected _ready: boolean = false;
    handleSetupInternally: boolean = true;
    private logLevelListener?: (event: Event) => void;

    constructor(worker?: Worker | URL) {
        super(worker)
        // ////console.log('NostrSqliteAdapter constructor')
        if (isBrowser()) {
            this.logLevelListener = (event: Event) => {
                const level = normalizeLogLevel(
                    (event as CustomEvent<LogLevel>).detail,
                    getGlobalLogLevel()
                );
                void this._relay?.setLogLevel(level).catch(() => {});
            };
            try {
                window.addEventListener('nostrwatch:loglevel', this.logLevelListener);
            } catch {}
        }
    }

    async destroy(){
       await this.shutdown();
    }

    /**
     * Properly shutdown the adapter by closing the SQLite database before terminating the worker.
     * This ensures the OPFS SAH Pool is released properly.
     * This method is idempotent - calling it multiple times is safe.
     */
    async shutdown(): Promise<void> {
        const relay = this._relay;
        if (this.logLevelListener) {
            try {
                window.removeEventListener('nostrwatch:loglevel', this.logLevelListener);
            } catch {}
            this.logLevelListener = undefined;
        }
        if (!relay) return;

        // Clear reference first to prevent double-shutdown
        this._relay = undefined;
        this._ready = false;

        try {
            // Close the database properly before terminating the worker
            // This releases the OPFS SAH Pool lock
            await relay.close('shutdown');
            // Give time for the database to fully close
            await delay(100);
        } catch (e) {
            console.warn('[NostrSqliteAdapter] Error closing relay during shutdown:', e);
        }
        // Now terminate the worker
        relay.abort();
    }

    setup(){}

    async abort(): Promise<boolean>{ 
        this.relay.abort();
        return true;
    }

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

    async newWorker(channelPort?: MessagePort): Promise<Worker | SharedWorker> {
        let worker;
        if(this.overloadWorker) {
            worker = this.overloadWorker
        }
        else if(import.meta.env.DEV) {
             /* @vite-ignore */
            worker = new Worker(new URL('./workers/nostrsqlite.worker.js', import.meta.url), { type: 'module' });
        } else {
            worker = new Worker(
                new URL("./workers/nostrsqlite.worker.js", import.meta.url),
                { type: 'module' }
            );
        }
        if(worker instanceof SharedWorker) {
            worker.port.start()
        }

        if(typeof channelPort === 'undefined') {
            throw new Error('NostrSqliteAdapter: channelPort is not defined')
        }

        this.relay = new WorkerRelayInterface(worker, channelPort);
        

        const ready = await this.relay
            .setup({ timeoutMs: 45_000 })
            .catch((err?: any) => this.handleWorkerError('setup', err));
        // console.log('ready?', ready  );
        if(!ready ) {
            throw new Error('NostrSqliteAdapter: failed to setup')
        }
        void this.relay.setLogLevel(getGlobalLogLevel()).catch(() => {});
        setTimeout(() => this._ready = ready, 500)
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

    async countNip11s(): Promise<number> {
        return this.relay.countNip11s();
    }

    async countUniqueNip11s(): Promise<number> {
        return this.relay.countUniqueNip11s();
    }

    async batchUpsertNip11(relayNip11s: {relay: string, nip11: any}[]): Promise<boolean> {
        return Promise.resolve(this.relay.batchUpsertNip11(relayNip11s));
    }

    async dumpNip11s(): Promise<any[]> {
        return this.relay.dumpNip11s();
    }

    async upsertNip11(relay: string, nip11: any): Promise<OkResponse> {
        return this.relay.upsertNip11({ relay, nip11 })
    }

    async getNip11(relay: string): Promise<any> {
        return this.relay.getNip11(relay)
    }

    async EVENT(event: IEvent): Promise<void> {
        await this.relay.event(event as unknown as NostrEvent)
    }

    async REQ(filters: ReqFilter[]): Promise<IEvent[]> {
        // ////console.log(filters)
        const message: ReqCommand = ['REQ', this.subId, ...filters];
        const promise = this.relay.query(message).catch((err?: any) => this.handleWorkerError(message, err))
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

    private handleWorkerError(context?: any, err?: any): false {
        if(err) {   
            console.error('context:', context, err)
        }
        if(isBrowser()) {
            // setTimeout( () => location.reload(), 2000 )
        }
        return false;
    }
}
