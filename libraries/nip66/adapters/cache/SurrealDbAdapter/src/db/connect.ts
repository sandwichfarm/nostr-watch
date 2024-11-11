import { Surreal } from 'surrealdb';
import { surrealdbWasmEngines } from '@surrealdb/wasm';
import { initDb } from '../utils/database';

export type ConnectionType = 'memory' | 'idb';

let db: Surreal;
let _connectionType: ConnectionType | undefined;

export default async ( type: ConnectionType, namespace: string = 'nostrwatch', database: string = 'nip66' ): Promise<Surreal> => {
    if(db && _connectionType === type) return db;
    let connectionType;
    switch(type){
        case 'memory':
            connectionType = 'mem://'
            break;
        case 'idb':
            connectionType = 'indxdb://RelayDb'
            break;
    }
    if(!connectionType) throw new Error('Invalid connection type');
    db = new Surreal({
        engines: surrealdbWasmEngines(),
    });
    await db.connect(connectionType);
    await initDb(db, namespace, database);
    return db;
}