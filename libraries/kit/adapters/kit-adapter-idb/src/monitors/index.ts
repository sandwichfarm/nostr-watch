import NDK from "@nostr-dev-kit/ndk";
import { MonitorRelayFetcher, KitCacheRelayMonitorInterface, RelayMonitorSetExt } from "@nostrwatch/kit";
import { IMonitor, type MonitorDb, monitorDb, MonitorTransform } from "@nostrwatch/idb";

import * as fastq from "fastq";
import type { queueAsPromised } from "fastq";

const setQueue: queueAsPromised<IMonitor> = fastq.promise(setWorker, 1)

async function setWorker (monitor: IMonitor): Promise<void> {
    let err = false 
    
    const onErr = () => { 
        err = true
        console.error('Error setting monitor data', err)
    }
    await monitorDb.monitors.put(monitor).catch(onErr)
}

export class MonitorCacheIdbAdapter implements KitCacheRelayMonitorInterface {

    db: MonitorDb;
    ndk: NDK | undefined;

    constructor(ndk?: NDK) {   
        this.db = monitorDb;
        this.ndk = ndk 
    }

    async set( monitorEvent: MonitorRelayFetcher ): Promise<boolean> {
        const data = MonitorTransform(monitorEvent);
        setQueue.push(data.monitor).catch((err) => console.error(err))
        // const created_at = monitorEvent.created_at as number

        // const data = MonitorTransform(monitorEvent);
        let err = false 
        
        // const onErr = () => { 
        //     err = true
        //     console.error('Error setting monitor data', err)
        // }
        // const response = await this.db.monitors.put(data.monitor).catch(onErr)

        // if(existing) {
        //     console.log('!!! monitor exists', existing)
        //     await existing
        //             .modify( function(monitor){
        //                 monitor.isActive = data.monitor.isActive
        //             })
        //             .catch(onErr)  
        // }
        // else {
        //     console.log('!!! monitor does not exist')
        //     await this.db.monitors.put(data.monitor).catch(onErr)
        // }
        
        return !err
    }

    async get( monitorPubkey: string ): Promise<MonitorRelayFetcher | undefined> {
        const monitor: IMonitor | undefined = await this.db.monitors.where({ monitorPubkey }).first()
        if(!monitor?.event) return undefined
        return new MonitorRelayFetcher(this.ndk, monitor.event)
    }
    
    async remove( monitorPubkey: string ): Promise<boolean> {
        const promises: Promise<void>[] = []
        let err = false 
        const onErr = () => { 
            err = true
            console.error('Error deleting monitor data', err)
        }
        await this.db.monitors.delete(monitorPubkey).catch(onErr)
        return !err
    }

    async keys(): Promise<Set<string>> {
        return new Set(await this.db.monitors.toCollection().primaryKeys())
    }

    async load( monitorEvents: RelayMonitorSetExt ): Promise<void> {
        if(!monitorEvents) return;
        const arr = Array.from(monitorEvents)
        arr.forEach( monitor => this.set(monitor))
    }

    async dump(): Promise<RelayMonitorSetExt> {
        const monitors: MonitorRelayFetcher[] = (await this.db.monitors.toArray()).map( ( monitor ) => new MonitorRelayFetcher(this.ndk, monitor.event))
        console.log('dump wtf', await this.db.monitors.toArray())
        return new Set(monitors) as RelayMonitorSetExt
    }

    async reset(): Promise<void> {
        this.db.monitors.clear();
    }
}
