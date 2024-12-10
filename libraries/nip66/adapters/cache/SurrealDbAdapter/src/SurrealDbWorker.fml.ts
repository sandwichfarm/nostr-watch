import { AdapterCacheWorker } from "@nostrwatch/nip66/core";

import type { 
    WorkerOptions, 
    AdapterCacheWorkerCommand, 
    IAdapterCacheWorker, 
    AdapterCacheWorkerResult
} from "@nostrwatch/nip66/core"

import { applyMixins } from '@nostrwatch/nip66/utils';
import type { IEvent } from "@nostrwatch/nip66/interfaces";

import { ConnectionType, RelayDb } from './db';
import { SurrealDbMethods } from "./SurrealDbMethods";
import Surreal, { LiveHandler, Uuid } from "surrealdb";
import { ICheck, IGeocode, IMonitor, INip11, IRelay } from "@nostrwatch/nip66/models";

type TableMap = {
    check: ICheck;
    relay: IRelay;
    geocode: IGeocode;
    monitor: IMonitor;
    nip11: INip11;
    event: IEvent;
};

type TableName = keyof TableMap;

const tables: TableName[] = ['event', 'relay', 'monitor', 'check', 'geocode', 'monitor', 'nip11' ];

export interface SurrealDbWorkerCommand extends AdapterCacheWorkerCommand {
    connectionType: ConnectionType;
}
  
export interface SurrealDbWorkerResult extends AdapterCacheWorkerResult {
    table: TableName;
    action: "CREATE" | "UPDATE" | "DELETE" | "CLOSE";
    payload: TableMap[TableName];
}

export class SurrealDbWorker extends AdapterCacheWorker implements IAdapterCacheWorker {
    private _db?: RelayDb;
    private _uuids: Record<TableName, Uuid> = {} as Record<TableName, Uuid>;
    protected _ready: boolean = false;
    private _unprocessed: IEvent[] = [];

    constructor( options: WorkerOptions ){
      super(options)
      //console.log('SurrealDbWorker constructor')
    }

    get db(): RelayDb {
        if(!this._db) throw new Error('Database not initialized');
        return this._db;
    }

    set db(db: RelayDb){
        this._db = db;
    }

    get store(): Surreal {
        if(!this.db) throw new Error('Database not initialized');
        return this.db.store;
    }

    async init(): Promise<void> {
    }

    async ready(): Promise<void> {
        await this.db.ready()
    }

    //TODO: Question life decisions.
    async sync() {
        for (const table of tables) {
            this._uuids[table] = await this.syncTableForType(table);
        }
    }

    private async syncTableForType<T extends TableName>(table: T): Promise<Uuid> {
        return this.syncTable<TableMap[T]>(table);
    }

    async syncTable<TableName extends keyof TableMap>(
        table: TableName
    ): Promise<Uuid> {
        return this.store.live(
            table,
            (([action, payload]: [action: "CREATE" | "UPDATE" | "DELETE" | "CLOSE", result: TableMap[TableName]]) => {
                if (action === "CLOSE") return;
                const message: SurrealDbWorkerResult = {
                    type: "record",
                    table,
                    action,
                    payload
                }
                this.mainThread?.postMessage(message);
            }) as unknown as LiveHandler<TableMap[TableName]>
        );
    }

    async addEvent(event: IEvent): Promise<void> {
      if(!this?.db) return console.warn('SurrealWorker: db not defined')
      if(!this.ready()){
        this._unprocessed.push(event)
        return
      }
      //console.log(this.db.isReady, this._unprocessed.length)
    //   if(this._unprocessed.length > 0){
    //     this.addEvents(this._unprocessed)
    //   }
    //   await this.db.addRawEvent(event)
    }

    async addEvents(events: IEvent[]): Promise<void> {
        // for(const event of events){
        //     await this.addEvent(event)
        // }
    }

    async setup(command: SurrealDbWorkerCommand){
        //console.log('SurrealDbWorker setup', command)
        const { connectionType: type } = command 
        this._db = new RelayDb({ type });
        await this.ready()
    }

}

export interface SurrealDbWorker extends SurrealDbMethods {}
applyMixins(SurrealDbWorker, [SurrealDbMethods]);