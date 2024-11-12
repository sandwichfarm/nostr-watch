import Surreal from "surrealdb";
import { surrealdbWasmEngines } from "@surrealdb/wasm";

import PQueue, { QueueAddOptions } from 'p-queue';

import { TransformEvent, transform30166, transform10166 } from '@nostrwatch/nip66/transform';
import { IEvent, IMonitor, IRelay, ICheck, INip11, IGeocode } from '@nostrwatch/nip66/models';

import { initDb } from "src/utils/database";

export interface RelayDbOpts {
    type: ConnectionType;
}

export const defaultRelayDbOpts: RelayDbOpts = {
    type: 'idb'
}

export type ConnectionType = 'memory' | 'idb' | 'indxdb' | 'indexeddb';

type Insertable<T> = {
    [K in keyof T]: T[K];
  } & { [key: string]: unknown };
  
function insertable<T>(value: T): Insertable<T> {
return value as unknown as Insertable<T>;
}

export class RelayDb {
    private _namespace: string = "nostrwatch";
    private _database: string = "nip66";

    private _store?: Surreal;
    private _connectionType?: ConnectionType;
    private _ready: boolean = false;    

    private monitorOrder: string[] = []

    private queue: PQueue = new PQueue({concurrency: 1});

    constructor(opts: RelayDbOpts = defaultRelayDbOpts){
        this._connectionType = opts.type;
        this.init().then( () => this._ready = true)
    }

    set namespace(namespace: string){
        this._namespace = namespace;
    }

    set database(database: string){
        this._database = database;
    }

    private set store(store: Surreal){
        this._store = store;
    }

    get store(): Surreal {
        if(!this._store) throw new Error('Database not initialized');
        return this._store;
    }

    get connectionType(): ConnectionType | undefined {  
        return this._connectionType;
    }

    get namespace(): string {
        return this._namespace;
    }

    get database(): string {
        return this._database;
    }

    get isReady(): boolean {
        return this._ready;
    }

    async ready(): Promise<void>{
        while(!this._ready){
            await new Promise(resolve => setTimeout(resolve, 50))
        }
    }

    async init(): Promise<void>{
        console.log('SurrealDb: Initializing');
        console.log(`connecting?`, await this.connect());
        await this.bootstrap();
    }

    private async connect(): Promise<void>{
        // const { surrealdbWasmEngines } = await import('@surrealdb/wasm');
        this.store = new Surreal({
            engines: surrealdbWasmEngines(),
        });
        let connectionType;
        console.log(`set connection type: ${this.connectionType?.toLowerCase()}`)
        switch(this.connectionType?.toLowerCase()){
            case 'indxdb':
            case 'indexeddb':
            case 'idb':
                connectionType = 'indxdb://RelayDb'
                break;
            case 'memory':
            default:
                connectionType = 'mem://'
                break;
        }
        if(!connectionType) throw new Error('Invalid connection type');
        console.log(`connecting to ${connectionType}`);
        await this.store.connect(connectionType);
        // console.log(await this.store.info())
    }

    private async bootstrap(): Promise<void>{
        await initDb(this.store, this.namespace, this.database);
    }

    async addRawEvent(event: IEvent): Promise<void | undefined> {
        if (event.kind === 10166) {
            await this.addRawMonitor(event);
        }
        if (event.kind === 30166) {
            await this.addRawCheck(event);
        }
    }

    async addEvent(event: IEvent): Promise<void | undefined> {
        await this.store.insert<Insertable<IEvent>>('event', insertable(event));
    }

    async addRawCheck(ev: IEvent): Promise<void | undefined> {
        const { check, relay, nip11, event, geocodes } = await transform30166(ev);
        await this.addEvent(event);
        await this.addCheck(check, relay);
        await this.addRelay(relay);
        if (nip11) 
            await this.addNip11(nip11, event.pubkey);
        if (geocodes?.length) {
            await this.addGeocodes(geocodes);
        }
    }

    async addRawMonitor(event: IEvent): Promise<void | undefined> {
        const { monitor } = await transform10166(event);
        if(!monitor) return console.warn('Error transforming MONITOR EVENT to check/relay records:', event);
        if(!this.monitorOrder.includes(monitor.id)) this.monitorOrder.push(event.pubkey);
        await this.addMonitor(monitor);
    }

    async addMonitor(monitor: IMonitor): Promise<void> {
        const existingMonitor = await this.store.query(`
          SELECT * FROM monitor WHERE id = $monitorId;
        `, { monitorId: monitor.id });
      
        if (existingMonitor.length > 0) {
          return;
        }
      
        await this.store.query(`
          CREATE monitor CONTENT $monitor;
        `, { monitor }).catch((error) => {
          console.error("Failed to add monitor:", error);
        });
    }

    async deleteMonitor(monitorPubkey: string): Promise<void> {
        await this.store.query(`
        DELETE FROM monitor WHERE id = $monitorPubkey;
        DELETE FROM event WHERE pubkey = $monitorPubkey;
        DELETE FROM check WHERE monitorPubkey = $monitorPubkey;
        DELETE FROM pastCheck WHERE monitorPubkey = $monitorPubkey;
        `, { monitorPubkey });
    }

    async deleteCheck(check: ICheck): Promise<void> {
        const { nid } = check;
        const existingCheck = await this.store.query(`
            SELECT * FROM check WHERE nid = $nid LIMIT 1;
        `, { nid });
        
        if (!existingCheck.length) return;
        
        await this.store.query(`
            CREATE pastCheck CONTENT $existingCheck;
            DELETE FROM check WHERE nid = $nid;
        `, { existingCheck: existingCheck[0], nid });
    }

    async deleteRelay(relay: string): Promise<void> {
        await this.store.query(`
          DELETE FROM relay WHERE id = $relay;
        `, { relay });
    }
    

    async addMonitorQ(monitor: IMonitor, qOpts: QueueAddOptions = { priority: 1 }): Promise<string | void> {
        return this.queue.add<string | void>(async () => this.addMonitor(monitor), qOpts);
    }

    async addCheck(check: ICheck, relayRecord: IRelay): Promise<void> {
        const { created_at, relay, monitorPubkey } = check;
        await this._updateRelay(relay, created_at, relayRecord);
        await this._processCheck(monitorPubkey, relay, check, created_at);
    }

    async addCheckQ(check: ICheck, relay: IRelay, qOpts: QueueAddOptions = { priority: 1 }): Promise<string | void> {
        return this.queue.add<string | void>(async () => this.addCheck(check, relay), qOpts);
    }

    async _processCheck(monitorPubkey: string, relay: string, check: ICheck, created_at: number): Promise<void> {
        const existingChecks = await this.store.query(`
            SELECT * FROM check WHERE relay = $relay AND monitorPubkey = $monitorPubkey AND nid != $checkNid;
        `, { relay, monitorPubkey, checkNid: check.nid });
    
        const nidsToDelete = existingChecks.map((existingCheck: any) => existingCheck.nid);
        if (nidsToDelete.length > 0) {
            await this.store.query(`DELETE FROM check WHERE nid IN $nidsToDelete`, { nidsToDelete });
        }
    
        const checkExists = await this.store.query(`SELECT * FROM check WHERE id = $checkNid`, { checkNid: check.nid });
        if (!checkExists.length) {
            await this.store.query(`CREATE check CONTENT $check`, { check });
        }
    }

    async _processCheckQ(monitorPubkey: string, relay: string, check: ICheck, created_at: number, qOpts: QueueAddOptions = { priority: 1 }): Promise<string | void> {
        this.queue.add(async () => {
            this._processCheck(relay, monitorPubkey, check, created_at);
        }, qOpts);
    }

    async _updateRelay(relay: string, created_at: number, relayRecord: IRelay){
        const updatedRelay = await this.store.query(`
            LET existingRelay = SELECT * FROM relay WHERE id = $relay;
            
            IF existingRelay THEN
              UPDATE relay SET lastSeen = IF(existingRelay.lastSeen < $created_at, $created_at, existingRelay.lastSeen) WHERE id = $relay;
            ELSE
              CREATE relay CONTENT $relayRecord;
            END;
        `, { relay, created_at, relayRecord });
    }

    async _updateRelayQ(relay: string, created_at: number, relayRecord: IRelay, qOpts: QueueAddOptions = { priority: 1 }): Promise<string | void> {
        this.queue.add(async () => {
            this._updateRelay(relay, created_at, relayRecord);
        }, qOpts);
        // { priority: 90 - this.getMonitorPriority(monitorPubkey) }
    }

    async addRelay(relay: IRelay): Promise<void | undefined> {
        return;
    }

    async addNip11(nip11: INip11, monitorPubkey: string): Promise<void> {
        this.queue.add(async () => {
          if (await this.nip11Exists(nip11)) return;
          await this.store.query(`
            CREATE nip11 CONTENT $nip11;
          `, { nip11 }).catch(console.warn);
        }, { priority: 80 - this.getMonitorPriority(monitorPubkey) });
    }
  
    async deleteNip11(params: Partial<INip11>): Promise<void> {
        await this.store.query(`
          DELETE FROM nip11 WHERE ${Object.keys(params)
            .map(key => `${key} = $${key}`)
            .join(' AND ')};
        `, params);
    }

    async deleteNip11ByRelay(relay: string): Promise<void> {
        await this.store.query(`
          DELETE FROM nip11 WHERE relay = $relay;
        `, { relay });
    }

    async deleteNip11ByMonitorPubkey(monitorPubkey: string): Promise<void> {
        await this.store.query(`
          DELETE FROM nip11 WHERE monitorPubkey = $monitorPubkey;
        `, { monitorPubkey });
    }

    async deleteNip11ByHash(hash: string): Promise<void> {
        await this.store.query(`
          DELETE FROM nip11 WHERE hash = $hash;
        `, { hash });
    }

    async addSsl(ssl: INip11, monitorPubkey: string): Promise<void | undefined> {
        return;
    }

    private getMonitorPriority(monitorPubkey: string): number {
        return this.monitorOrder.indexOf(monitorPubkey);
    }

    async addGeocodes(geocodes: IGeocode[]): Promise<void> {
        if (!geocodes?.length) return;
        
        for (const geocode of geocodes) {
          if (await this.geocodeExists(geocode)) continue;
      
          await this.store.query(`
            CREATE geocode CONTENT $geocode;
          `, { geocode }).catch(console.warn);
        }
    }
      

    async geocodeExists(geocode: IGeocode): Promise<boolean> {
        const { code } = geocode;
        const result = await this.store.query(`
          SELECT * FROM geocode WHERE code = $code LIMIT 1;
        `, { code });
        return result.length > 0;
    }

    async eventExists(event: IEvent): Promise<boolean> {
        const { id } = event;
        const result = await this.store.query(`
          SELECT * FROM event WHERE id = $id LIMIT 1;
        `, { id });
        return result.length > 0;
      }
    
      async checkExists(check: ICheck): Promise<boolean> {
        const { nid } = check;
        const result = await this.store.query(`
          SELECT * FROM check WHERE nid = $nid LIMIT 1;
        `, { nid });
        return result.length > 0;
      }
    
      async relayExists(relay: string): Promise<boolean> {
        const result = await this.store.query(`
          SELECT * FROM relay WHERE id = $relay LIMIT 1;
        `, { relay });
        return result.length > 0;
      }
    
      async monitorExists(monitor: IMonitor): Promise<boolean> {
        const { id } = monitor;
        const result = await this.store.query(`
          SELECT * FROM monitor WHERE id = $id LIMIT 1;
        `, { id });
        return result.length > 0;
      }
    
      async nip11Exists(nip11: INip11): Promise<boolean> {
        const { hash } = nip11;
        const result = await this.store.query(`
          SELECT * FROM nip11 WHERE hash = $hash LIMIT 1;
        `, { hash });
        return result.length > 0;
      }
      
}

export default RelayDb;