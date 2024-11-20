
import { AdapterCacheWorker, AdapterCacheWorkerCommand, AdapterWorkerMessage, WorkerOptions } from '@nostrwatch/nip66/core';
import type { IEvent } from '@nostrwatch/nip66/interfaces'

import { handleMsg as relayHandler, insertBatch, WorkerState, relayInit, messageChannelInit, relayEvent, InitAargs, relayWipe } from '@nostrwatch/worker-relay/dist/worker-utils'

export class NostrSqliteWorker extends AdapterCacheWorker {
    state: WorkerState = {
        self: this.mainThread as DedicatedWorkerGlobalScope,
        eventWriteQueue: [],
        relay: undefined,
        messageChannel: undefined,

        insertBatchEvery: 1000,
        insertBatchSize: 25,
        lastBatch: 0
    }
    relay = relayHandler;
    private batcher: ReturnType<typeof setTimeout> = setTimeout(() => { insertBatch(this.state) }, 500)
    
    constructor( options: WorkerOptions ){
        super(options)
        //console.log('NostrSqliteWorker constructor')
        this.setupHandlers()
    }

    destroy(){
        clearTimeout(this.batcher)
    }
    
    async setup(command: AdapterWorkerMessage){ 
        //console.log(`NostrSqliteWorker: setup()`,  command)
        const conf: InitAargs = {
            databasePath: "relay.43432.db",
            insertBatchSize: this.state.insertBatchSize
        }
        await relayInit(this.state, conf).catch( async () => {
            await relayWipe(this.state)
            this.setup(command);
        })
        if(command?.channelPort){
            this.state.messageChannel = command.channelPort
            this.setupChannelHandlers()
        }
        //console.log(this.channel)
    }

    setupHandlers(){
        //console.log('NostrSqliteWorker: setupHandlers()')
        if(!this?.mainThread) return console.warn('NostrSqliteWorker: mainThread not defined')
        this.mainThread.onmessage = async (message: MessageEvent) => {
          //console.log(`NostrSqliteWorker: From Main Thread:`, message.data)
          if(message.data.type === 'setup'){
            //console.log('NostrSqliteWorker: setup()')
            await this.__setup(message.data)
            return
          }
          else {
            this.fromMainThread(message);
          }
        }
        if(this.state?.messageChannel){
            this.state.messageChannel.onmessage = async (message: MessageEvent) => {
                //console.log(`NostrSqliteWorker: Over MessageChannel: ${message.data.cmd} -> ${message.data.args}`)
                this.relay(this.state, message)
            }
        }
        
    }

    setupChannelHandlers(){
        if(!this.state.messageChannel) return console.warn('channel not defined')
        this.state.messageChannel.onmessage = (message: MessageEvent) => {
          const command = message.data as AdapterCacheWorkerCommand;
          this.onChannelMessage(command);
        }
        this.state.messageChannel.onmessageerror = this.onMessageError
      }

    fromMainThread(ev: MessageEvent) {
        //console.log(`CacheWorker: From Main Thread:`, ev)
        this.relay(this.state, ev)
    }
    
    async addEvent(nostrEvent: IEvent) {
        // console.log(`NostrSqliteWorker: Over MessageChannel: addEvent() -> ${nostrEvent.id}`)
        relayEvent(this.state, nostrEvent)
    }
    
    async addEvents(nostrEvents: IEvent[]) {
        console.log(`NostrSqliteWorker: Over MessageChannel: relay.eventBatch() -> ${nostrEvents.length}`)
        this?.state?.relay?.eventBatch?.(nostrEvents)
        // for(const event of nostrEvents){
        //     this.addEvent(event)
        // }
    }
}

export default NostrSqliteWorker;