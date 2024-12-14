import { AdapterCacheWorker, AdapterWorkerResultType } from "@nostrwatch/nip66/core";

import type { 
    WorkerOptions, 
    AdapterCacheWorkerCommand, 
    IAdapterCacheWorker, 
    AdapterCacheWorkerResult
} from "@nostrwatch/nip66/core"

import { applyMixins } from '@nostrwatch/nip66/utils';
import type { IEvent } from "@nostrwatch/nip66/interfaces";

import { ICheck, IGeocode, IMonitor, INip11, IRelay } from "@nostrwatch/nip66/models";
import { ConnectionType } from "./db";

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

    constructor( options: WorkerOptions ){
      super(options)
      ////console.log('SurrealDbWorker constructor')
    }
    async init(): Promise<void> {}
    async ready(): Promise<void> {}

    async addEvent(event: IEvent): Promise<void> {
        this.command('toAdapter', AdapterWorkerResultType.event, event)
    }

    async addEvents(events: IEvent[]): Promise<void> {
      this.command('toAdapter', AdapterWorkerResultType.events, events)
    }

    async setup(command: SurrealDbWorkerCommand){}
}