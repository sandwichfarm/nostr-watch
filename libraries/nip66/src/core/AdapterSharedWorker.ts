import { NostrEvent } from "@base/models/NostrEvent";

import { ICacheAdapterSharedWorkerCommand } from "@base/interfaces/ICacheAdapterSharedWorkerCommand";
import { IMainThreadResponse } from "@base/interfaces/IMainThreadResponse";

import { IWorkerCommand } from "../interfaces";

export enum WorkerContext {
  MainThread = 0,
  SharedWorker = 1,
  DedicatedWorker = 2
}

export interface AdapterSharedWorkerCommand extends IWorkerCommand {
  channelPort?: MessagePort
  mainThreadPort?: MessagePort;
  sharedWorkerPort?: MessagePort;
}


export interface SharedWorkerOptions {
  mainThreadPort?: MessagePort;
  channelPort?: MessagePort;
  sharedWorkerPort?: MessagePort; 
}

export class AdapterSharedWorker {

  private _context?: WorkerContext
  private _mainThreadPort?: MessagePort;
  private _channelPort?: MessagePort;
  private _sharedWorkerPort?: MessagePort;

  constructor( options?: SharedWorkerOptions ){
    if(!options) return 
    this.setContext(options)
  }

  get context(): WorkerContext | undefined {  
    return this._context
  }

  get mainThread(): MessagePort | undefined {
    return this._mainThreadPort;
  }

  set channel( port: MessagePort ){
    this._channelPort = port
  }

  get channel(): MessagePort | undefined {
    return this._channelPort
  }

  set sharedWorker( port: MessagePort ){
    this._sharedWorkerPort = port
  }

  get sharedWorker(): MessagePort | undefined {
    return this._sharedWorkerPort
  }

  setContext(options?: SharedWorkerOptions){
    if(!options) {
      options = {
        mainThreadPort: this?.mainThread,
        channelPort: this?.channel,
        sharedWorkerPort: this?.sharedWorker
      }
    }
    if( options?.mainThreadPort ) {
      this._context = WorkerContext.SharedWorker
      this._mainThreadPort = options.mainThreadPort
    }
    else if( options?.channelPort ) {
      this._context = WorkerContext.SharedWorker
      this._channelPort = options.channelPort
    }
    else if( options?.sharedWorkerPort) {
      this._context = WorkerContext.DedicatedWorker
      this._sharedWorkerPort = options.sharedWorkerPort
    }
    console.log(this.constructor.name, 'context:', this._context)
  }

  setup(command: AdapterSharedWorkerCommand){}

  _setup(command: AdapterSharedWorkerCommand){
    const { channelPort } = command
    if(channelPort) {
      this.channel = channelPort
      this.setupChannelHandlers()
    }
    this.setup(command)
  }

  setupChannelHandlers(){
    if(!this.channel) return
    this.channel.onmessage = (message: MessageEvent) => {
      const command = message.data as AdapterCacheSharedWorkerCommand;
      this.onMessage(command)
    }
    this.channel.onmessageerror = this.onMessageError
  }

  postMessageMainThread( response: IMainThreadResponse ){
    if(!this?.mainThread) return
    this.mainThread.postMessage( response )
  }

  postMessageSharedWorker( response: IMainThreadResponse ){
    if(!this.channel) return
    this.channel.postMessage( response )
  }

  postMessageDedicatedWorker( response: IMainThreadResponse ){
    if(!this.sharedWorker) return
    this.sharedWorker.postMessage( response
  }
  
  onMessage(command: ICacheAdapterSharedWorkerCommand){}
  onMessageError(){}
  onError(){}

}