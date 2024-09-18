import { ICacheAdapterSharedWorkerCommand } from "@base/interfaces/ICacheAdapterSharedWorkerCommand";

import { IWorkerCommand } from "../interfaces";

export enum SharedWorkerContext {
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

  private _context?: SharedWorkerContext
  private _mainThreadPort?: MessagePort;
  private _channelPort?: MessagePort;
  private _sharedWorkerPort?: MessagePort;

  constructor( options?: SharedWorkerOptions ){
    if(!options) return 
    // this.setContext(options)
  }

  get context(): SharedWorkerContext | undefined {  
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
      this._context = SharedWorkerContext.SharedWorker
      this._mainThreadPort = options.mainThreadPort
    }
    else if( options?.channelPort ) {
      this._context = SharedWorkerContext.SharedWorker
      this._channelPort = options.channelPort
    }
    else if( options?.sharedWorkerPort) {
      this._context = SharedWorkerContext.MainThread
      this._sharedWorkerPort = options.sharedWorkerPort
    }
    //console.log(this.constructor.name, 'context:', this._context)
  }

  //overload this.
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
      const command = message.data as ICacheAdapterSharedWorkerCommand;
      this.onMessage(command)
    }
    this.channel.onmessageerror = this.onMessageError
  }

  postMessage( command: AdapterSharedWorkerCommand, where: SharedWorkerContext = SharedWorkerContext.MainThread ) {
    switch(where as SharedWorkerContext){
      case SharedWorkerContext.MainThread:
        this.postMessageAdapter(command)
        break;
      case SharedWorkerContext.SharedWorker:
        this.postMessageSharedWorker(command)
        break;
      case SharedWorkerContext.DedicatedWorker:
        this.postMessageDedicatedWorker(command)
        break;
    }
  }

  postMessageAdapter( command: AdapterSharedWorkerCommand ){
    if(!this?.mainThread) return
    this.mainThread.postMessage( command )
  }

  postMessageSharedWorker( command: AdapterSharedWorkerCommand ){
    if(!this.channel) return
    this.channel.postMessage( command )
  }

  postMessageDedicatedWorker( command: AdapterSharedWorkerCommand ){
    if(!this.sharedWorker) return
    this.sharedWorker.postMessage( command )
  }



  // postMessageAdapter( response: IMainThreadResponse ){
  //   if(!this?.mainThread) return
  //   this.mainThread.postMessage( response )
  // }

  // postMessageSharedWorker( response: IMainThreadResponse ){
  //   if(!this.channel) return
  //   this.channel.postMessage( response )
  // }

  // postMessageDedicatedWorker( response: IMainThreadResponse ){
  //   if(!this.sharedWorker) return
  //   this.sharedWorker.postMessage( response
  // }
  
  onMessage(command: ICacheAdapterSharedWorkerCommand){}
  onMessageError(){}
  onError(){}

}