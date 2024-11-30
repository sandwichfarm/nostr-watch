
import { AdapterCacheWorker, AdapterCacheWorkerCommand, AdapterWorkerMessage, WorkerOptions } from '@nostrwatch/nip66/core';
import type { IEvent } from '@nostrwatch/nip66/interfaces'

import { handleMsg as relayHandler, insertBatch, WorkerState, relayInit, messageChannelInit, relayEvent, InitAargs, relayWipe } from '@nostrwatch/worker-relay/dist/worker-utils'

export class NostrSqliteWorker extends AdapterCacheWorker {
    state: WorkerState =  {
        self: self as SharedWorkerGlobalScope | DedicatedWorkerGlobalScope,
        eventWriteQueue: [],
        relay: undefined,
        messageChannel: undefined,
        insertBatchEvery: 1000,
        insertBatchSize: 25,
        lastBatch: 0,
    };
    relay = relayHandler;

    private batcher: ReturnType<typeof setTimeout> = setTimeout(() => insertBatch(this.state), this.state.insertBatchEvery);

    constructor(options: WorkerOptions) {
        super(options);
        console.log('NostrSqliteWorker', this.state)
        console.log('NostrSqliteWorker constructor');
        this._setupHandlers()
    }

    destroy() {
        clearTimeout(this.batcher);
        if (this.state.messageChannel) {
            this.state.messageChannel.close();
        }
        console.log('NostrSqliteWorker destroyed');
    }

    async setup(command: AdapterWorkerMessage) {
        console.log(`NostrSqliteWorker: setup()`, command);
        const conf: InitAargs = {
            databasePath: "relay.db",
            insertBatchSize: this.state.insertBatchSize,
        };

        try {
            await relayInit(this.state, conf);
        } catch (err) {
            console.error('Setup failed, retrying with wipe:', err);
            await relayWipe(this.state);
            await this.setup(command);
        }

        if (command?.channelPort) {
            this.state.messageChannel = command.channelPort;
            this.setupChannelHandlers();
        }
    }

    //do nothing.
    setupHandlers(){}

    _setupHandlers() {
        this.state.self = typeof SharedWorkerGlobalScope !== 'undefined' && this.mainThread instanceof SharedWorkerGlobalScope 
            ? this.mainThread as SharedWorkerGlobalScope 
            : this.mainThread as DedicatedWorkerGlobalScope;
    
        const onmessage = async (message: MessageEvent) => {
            console.log(`NostrSqliteWorker: Received:`, message.data);
            if (message.data.type === 'setup') {
                await this.setup(message.data);
            } else {
                this.fromMainThread(message);
            }
        };

        if (this.state.self instanceof DedicatedWorkerGlobalScope) {
            console.log('Running in DedicatedWorkerGlobalScope');
            this.state.self.onmessage = onmessage;
        } else if (this.state.self instanceof SharedWorkerGlobalScope) {
            console.log('Running in SharedWorkerGlobalScope');
            this.state.self.onconnect = (event: MessageEvent) => {
                const port = event.ports[0];
                port.onmessage = onmessage;
            };
        }
    }

    setupChannelHandlers() {
        if (!this.state.messageChannel) return console.warn('Channel not defined');
        this.state.messageChannel.onmessage = (message: MessageEvent) => {
            const command = message.data as AdapterCacheWorkerCommand;
            this.onChannelMessage(command);
        };
        this.state.messageChannel.onmessageerror = this.onMessageError;
    }

    fromMainThread(ev: MessageEvent) {
        console.log(`CacheWorker: From Main Thread:`, ev);
        if(this.state.relay) 
        this.relay(this.state, ev);
    }

    async addEvent(nostrEvent: IEvent) {
        relayEvent(this.state, nostrEvent);
    }

    async addEvents(nostrEvents: IEvent[]) {
        console.log(`NostrSqliteWorker: relay.eventBatch() -> ${nostrEvents.length}`);
        this?.state?.relay?.eventBatch?.(nostrEvents);
    }
}

export default NostrSqliteWorker;
