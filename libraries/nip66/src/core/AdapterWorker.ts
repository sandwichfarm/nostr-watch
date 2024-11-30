/// <reference lib="webworker" />

import { IEvent, ISharedWorkerGlobalScope, IWorkerCommand, IWorkerGlobalScope } from "../interfaces";
import { NostrEvent } from "nostr-tools";
import { Workers } from "./Workers";
import { AdapterMessage } from "./Adapter";

export enum WorkerContext {
  MainThread = 0,
  Worker = 1,
  DedicatedWorker = 2
}

export interface AdapterWorkerMessage extends AdapterMessage {}

export interface AdapterWorkerCommand extends AdapterWorkerMessage {
  command?: string;
  channelPort?: MessagePort
  mainThread?: IWorkerGlobalScope | ISharedWorkerGlobalScope;
}

export enum AdapterWorkerResultType {
  "events" = "events",
  "event" = "event",
  "record" = "record",
  "records" = "records",
}

export interface AdapterWorkerResult extends AdapterWorkerMessage {
  result?: ArrayBuffer;
  resultType?: AdapterWorkerResultType;
}

export interface WorkerOptions {
  mainThread?: IWorkerGlobalScope | ISharedWorkerGlobalScope;
  channelPort?: MessagePort;
}

export class AdapterWorker {

  private _mainThread?: IWorkerGlobalScope | ISharedWorkerGlobalScope;
  private _channelPort?: MessagePort;

  constructor( options?: WorkerOptions ){
    if(!options) return 
    console.log('AdapterWorker', options)
    this._mainThread = options?.mainThread
    this._channelPort = options?.channelPort
    this.setupHandlers()
  }
  get mainThread(): IWorkerGlobalScope | ISharedWorkerGlobalScope | undefined {
    return this._mainThread;
  }

  set channel( port: MessagePort ){
    this._channelPort = port
  }

  get channel(): MessagePort | undefined {
    return this._channelPort
  }

  //overload this.
  async setup(command: AdapterWorkerMessage): Promise<void>{
    console.warn(`${this.constructor.name} setup() method not implemented`)
  }

  async _setup(command: AdapterWorkerMessage): Promise<void>{
    console.warn(`${this.constructor.name}: Adapter\'s Worker _setup() method not implemented`)
  }

  async __setup(command: AdapterWorkerMessage): Promise<void>{
    console.log(`${this.constructor.name}: AdapterWorker.__setup`, command)
    const { channelPort } = command
    if(channelPort) {
      console.log(`[Worker:${this.constructor.name}] channelPort:`, channelPort)
      this.channel = channelPort
      this.setupChannelHandlers()
    }
    await this._setup(command)
    return this.setup(command)
  }

  setupChannelHandlers(){
    if(!this.channel) return console.warn('channel not defined')
    this.channel.onmessage = (message: MessageEvent) => {
      const command = message.data as AdapterWorkerMessage;
      console.log(`[Worker:${this.constructor.name}] channel.onmessage`, command)
      this.listenPingPong('channel', command)
      this.onChannelMessage(command);
    }

    console.log('setupChannelHandlers', this.channel)
    this.channel.onmessageerror = this.onMessageError
  }

  setupHandlers(){
    console.log('AdapterWorker: setupHandlers()')
    if(!this?.mainThread) return console.warn('mainThread not defined')
    const onmessage = async (message: MessageEvent) => {
      const command = message.data as AdapterWorkerMessage;
      console.log(`[Worker:${this.constructor.name}] mainthread.onmessage`, command)
      this.listenPingPong('mainthread', command)
      if(command.type === 'setup'){
        await this.__setup(command)
        return
      }
      this.onMainThreadMessage(command);
    }
    if(this.mainThread instanceof DedicatedWorkerGlobalScope){
      console.log('Running in DedicatedWorkerGlobalScope');
      (this.mainThread as IWorkerGlobalScope).onmessage = onmessage
    }
    else if(this.mainThread instanceof SharedWorkerGlobalScope){
      (this.mainThread as ISharedWorkerGlobalScope).port.onmessage = onmessage
    }
  }


  command(destination: string | string[], resultType: AdapterWorkerResultType, result: any){
    console.log('AdapterWebsocketWorker: command', destination, resultType, result)
    result = this.encode(result) as ArrayBuffer
    const message: AdapterWorkerMessage = {
      type: 'result',
      resultType,
      result
    }
    const transferable = result as Transferable
    if(destination.includes('toChannel')){
      const resultTypeCap = resultType.charAt(0).toUpperCase() + resultType.slice(1)
      message.type = resultTypeCap
      this.postMessageChannel( message, [transferable] )
    } 
    if(destination.includes('toAdapter')){  
      this.postMessageAdapter( message, [transferable] )
    }
  }

  postMessageAdapter( command: AdapterWorkerMessage, transfer?: Transferable[] ): void {
    if(!this?.mainThread) return console.warn(`cannot send message to mainThread: undefined`)
    this.mainThread.postMessage( command, transfer )
  }

  postMessageChannel( command: AdapterWorkerMessage, transfer?: Transferable[]  ): void {
    if(!this?.channel) return console.warn(`cannot send message through message channel: undefined`)
    if(transfer) {
      return this.channel.postMessage( command, transfer )
    }
    this.channel.postMessage( command )
  }
  // overloads
  async onMainThreadMessage(command: AdapterWorkerMessage): Promise<void>{ return console.warn(`onMainThreadMessage not overloaded by adapter, so the following is going nowhere fast:`, command)  }
  async onChannelMessage(command: AdapterWorkerMessage): Promise<void>{ return console.warn(`onChannelMessage not overloaded by adapter, so the following is going nowhere fast:`, command) }
  async onMessageError(){}
  async onError(){}

  encode (json: IEvent[] | IEvent): ArrayBuffer {
    return Workers.encodeNostrEventArrayAsBuffer(json)
  }

  decode (arrayBuffer: ArrayBuffer): IEvent[] | IEvent {
    return Workers.decodeNostrEventArrayFromBuffer(arrayBuffer)
  }


  /*sanity check*/

  private pingChannel(){
    console.log(`[Worker:${this.constructor.name}] o/o SEND: PING -> channel`)
    this.postMessageChannel({ type: 'ping' })
  }

  private pongMainThread(){
    console.log(`[Worker:${this.constructor.name}] o/o SEND: PONG -> mainthread`)
    this.postMessageAdapter({ type: 'pong', })
  }

  private pongChannel(){
    console.log(`[Worker:${this.constructor.name}] o/o SEND: PONG -> channel`)
    this.postMessageChannel({ type: 'pong' })
  }

  private listenPingPong(from: 'channel' | 'mainthread', command: AdapterWorkerMessage): void {
    if(command.type === 'ping') {
      console.log(`[Worker:${this.constructor.name}] o/o RECIEVE: PING <- ${from}`)
      if(from === 'mainthread'){
        this.pingChannel()
        this.pongMainThread()
      }
      if(from === 'channel'){
        this.pongChannel()
      }
      return
    }
    if(command.type === 'pong') {
      console.log(`[Worker:${this.constructor.name}] o/o RECIEVE: PONG <- ${from}`)
    }
  }

}