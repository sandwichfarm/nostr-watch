import { isLivesyncing } from "$stores/app";
import { publishEventsToMemoryRelay } from "$stores/events-helpers";
import { route66 } from "$stores/route66";
import type { Route66 } from "@nostrwatch/route66";
import { Batcher, type SubscribeHandlers } from "@nostrwatch/route66/core";
import type { IEvent } from "@nostrwatch/route66/models";
import { get, type Writable } from "svelte/store";
import { instance } from "./lifecycle";

export type LiveSyncResumer = () => Promise<void>

let $route66: Route66 | null = get(route66)

export const beginLiveSync = async (callbacks?: SubscribeHandlers): Promise<void> => {
    isLivesyncing.set(true)
    if(!$route66){
        $route66 = await instance();
    }
    $route66?.services?.monitors?.beginLiveSync(callbacks)
}

export const stopLiveSync = async (): Promise<void> => {
    isLivesyncing.set(false)
    if(!$route66){
        $route66 = await instance();
    }
    $route66?.services?.monitors?.stopLiveSync()
}

export const pauseLiveSync = async (): Promise<LiveSyncResumer> => {
    let wasLiveSyncing = get(isLivesyncing)? true: false;
    if(!$route66){
        $route66 = await instance();
    }
    if(wasLiveSyncing){
        await stopLiveSync()
    }
    return async () => {
        if(wasLiveSyncing){
            beginLiveSync()
        }
    }
}

let liveSyncBatcher: Batcher<IEvent, any> = new Batcher<IEvent, any>({
    maxLength: 50, 
    timeout: 30000,
    callback: (events: IEvent[]) => publishEventsToMemoryRelay(events, 'livesyncer')
})

export const liveSync = () => {
    if(get(isLivesyncing)) return;
    const onevents = (events: IEvent[]) => {
        for(const event of events){
            liveSyncBatcher.add(event); 
        }
    }
    beginLiveSync({ onevents })
}