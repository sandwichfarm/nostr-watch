import { handleMsg as relayHandler, insertBatch, WorkerState, relayInit, relayEvent, InitAargs } from '@nostrwatch/worker-relay/dist/worker-utils'
import type { IEvent } from '@nostrwatch/nip66/interfaces'
import { AdapterCacheWorker, type AdapterCacheWorkerCommand } from '@nostrwatch/nip66/core';
import { Filter } from 'nostr-tools';


export interface WorkerRelayEventMessage extends MessageEvent {
    data: {
        cmd: 'event',
        args: IEvent
    }
}

interface WorkerRelayInitMessageData {
    databasePath: string;
    insertBatchSize: number;
}

export interface WorkerRelayInitMessage extends MessageEvent {
    data: {
        id: 'workerRelayInit',
        cmd: 'init',
        args: WorkerRelayInitMessageData
    }
}

export class NostrSqliteWorker extends AdapterCacheWorker {
    state: WorkerState = {
        self: this.mainThread as DedicatedWorkerGlobalScope,
        insertBatchSize: 100,
        eventWriteQueue: [],
        relay: undefined
    }
    relay = relayHandler;
    private batcher: ReturnType<typeof setInterval> = setInterval(() => { insertBatch(this.state) }, 1000)
    
    constructor() {
        super()
        console.log('NostrSqliteWorker constructor')
    }

    destroy(){
        clearInterval(this.batcher)
    }
    
    async setup() {
        const conf: InitAargs = {
            databasePath: "relay.db",
            insertBatchSize: 50
        }
        await relayInit(this.state, conf)
    }

    setupHandlers(){
        if(!this?.mainThread) return console.warn('mainThread not defined')
        this.mainThread.onmessage = async (message: MessageEvent) => {
          this.fromMainThread(message);
        }
    }

    fromMainThread(ev: MessageEvent) {
        this.relay(this.state, ev)
    }
    
    async addEvent(nostrEvent: IEvent) {
        relayEvent(this.state, nostrEvent)
    }
    
    async addEvents(nostrEvents: IEvent[]) {
        for(const event of nostrEvents){
            this.addEvent(event)
        }
    }
}

export default NostrSqliteWorker;