import { Filter } from "nostr-tools";
import { 
  AdapterWorkerCommand,
  AdapterWorker, 
  AdapterWorkerResultType, 
  WorkerOptions 
} from "./AdapterWorker"
import { IEvent } from "@base/models";
import { defaultWebsocketAdapterOptions, defaultWebsocketRequest, defaultWebsocketRequestBody, SubscribeHandlers, WebsocketAdapterFetchOptions, WebsocketAdapterOptions, WebsocketRequest, WebsocketRequestBody } from "./WebsocketAdapter";
import { Batcher } from "./Batcher";

export enum ResponseType {
  event = 'event',
  events = 'events',
  complete = 'complete',
  error = 'error',
  unsubscribed = 'unsubscribed',
  aborted = 'aborted',
  terminated = 'terminated'
}

export interface AdapterWebsocketWorkerOptions {
  connectToRelays: string[]
}

export type AdapterWebsocketWorkerCommandTypes = "subscribe" | "fetch"

export interface AdapterWebsocketWorkerCommand extends AdapterWorkerCommand {
  type: AdapterWebsocketWorkerCommandTypes
  hash: string,
  filters: Filter[];
  options?: AdapterWebsocketWorkerOptions
}

interface WebsocketResponse extends WebsocketResponseHeaders {
  args: WebsocketResponseBody
}

interface WebsocketResponseHeaders {
  to: 'cache' | 'adapter',
}

export type WebsocketResponseBody = {
  type: 'event' | 'events' | 'error' | 'complete' | 'unsubscribed' | 'aborted' | 'terminated',
  result: any,
  hash: string
}

export const defaultWebsocketResponseHeaders: WebsocketResponseHeaders = { 
  to: 'cache'
}

export const defaultWebsocketResponseBody: WebsocketResponseBody = {
  type: 'event',
  result: null,
  hash: ''
}

export const defaultWebsocketResponse: WebsocketResponse = {
  ...defaultWebsocketResponseHeaders,
  args: defaultWebsocketResponseBody
}

export type WebsocketAdapterResult = void | undefined | IEvent | IEvent[];

export interface IAdapterWebsocketWorker {
  setup(command: AdapterWebsocketWorkerCommand): Promise<void>;
  subscribe( request: WebsocketRequestBody ): Promise<void>;
  fetch( request: WebsocketRequestBody ): Promise<void>;
  publish( request: WebsocketRequestBody ): Promise<void>;

  signal: AbortSignal;
  controller: AbortController;
}

export class AdapterWebsocketWorker extends AdapterWorker {
  protected relays: string[] = ['wss://relaypag.es/', 'wss://relay.nostr.watch/']
  private batchQueue: IEvent[] = []
  private batcher: Batcher<IEvent, WebsocketRequestBody>;
  protected _controller: AbortController = new AbortController();
  protected _signal: AbortSignal = this._controller.signal;

  constructor( options?: WorkerOptions ){
    ////console.log ('AdapterWebsocketWorker', options)
    super(options)
    this.batcher = new Batcher<IEvent, WebsocketRequestBody>({
      maxLength: 100, 
      timeout: 2000,
      callback: this.batchResponse.bind(this)
    })
  }

  get signal(): AbortSignal { return this._signal }
  get controller(): AbortController { return this._controller }

  async _setup(command: AdapterWorkerCommand): Promise<void>{
    const { options } = command
    let connectToRelays 
    if(options){
      connectToRelays = options.connectToRelays
    }
    if( connectToRelays ){
      this.relays = connectToRelays
    }
    if( !this.relays.length  ){
      console.warn('AdapterWebsocketWorker: cannot connect to relays, length is 0')
    }
  }

  async onMainThreadMessage(request: WebsocketRequest): Promise<void> {
    this.onMessage(request)
  }

  async onChannelMessage(request: WebsocketRequest): Promise<void>  {
    this.onMessage(request)
  }

  onMessage(request: WebsocketRequest = defaultWebsocketRequest){
    const { action, args } = request
    if(action === 'publish'){
      return this.publish(args)
    }
    if(action === 'subscribe'){
      return this.subscribe(args)
    }
    if(action === 'fetch'){
      return this.fetch(args)
    }
    if(action === 'unsubscribe'){
      return this.unsubscribe(args)
    }
    if(action === 'abort'){
      return this._abort()
    }
    console.warn('AdapterWebsocketWorker: onMessage: did not match any command', request)
  }

  send(response: WebsocketResponse = defaultWebsocketResponse){
    //console.log('send.')
    const { to, args } = response
    let sent = false
    if(to === 'adapter'){
      if(!this?.mainThread) return console.warn('AdapterWebsocketWorker: mainThread not found')
      this.mainThread.postMessage(args)
      sent = true
    }
    if(to === 'cache'){
      if(!this.channel) return console.warn('AdapterWebsocketWorker: channel not found')
      this.channel.postMessage(args)
      sent = true
    }
    if(!sent) console.warn('AdapterWebsocketWorker: send: did not send to any destination')
  }

  async publish(request: WebsocketRequestBody = defaultWebsocketRequestBody ){
    if(this.signal.aborted) this.abortControllerReset()
    const success = await this._publish(request)
    const responseType = success? ResponseType.complete : ResponseType.error
    if(success){ 
      this.respond(responseType, request)
    }
  }

  async _publish(request: WebsocketRequestBody = defaultWebsocketRequestBody): Promise<boolean> {
    throw new Error(`${this.constructor.name}:_publish() not implemented!`)
  }

  async subscribe( request: WebsocketRequestBody = defaultWebsocketRequestBody ){
    if(this.signal.aborted) this.abortControllerReset()
    const { options } = request
    const { stream } = options ?? defaultWebsocketAdapterOptions;
    let callbacks: SubscribeHandlers | undefined;
    if(stream){
      callbacks = this.requestCallbacks(request);
    }
    const result = await this._subscribe(request, callbacks)
    if(!stream){
      this.requestSyncResponse(request, result as IEvent[])
    }
    if( !options?.keepAlive ){
      this.respond(ResponseType.complete, request)
    }
  }

  unsubscribe(args: WebsocketRequestBody){ args }

  async _subscribe(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> { 
    throw new Error(`${this.constructor.name}:_subscribe() not implemented!`)
  }

  async fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody){
    if(this.signal.aborted) this.abortControllerReset()
    const { options } = request
    const { stream } = options ?? defaultWebsocketAdapterOptions;
    let callbacks: SubscribeHandlers | undefined;
    if(stream){
      callbacks = this.requestCallbacks(request);
    }
    const result = await this._fetch(request, callbacks)
    if(!stream){
      this.requestSyncResponse(request, result as IEvent[])
    }
    this.respond(ResponseType.complete, request)
  }

  async _fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    throw new Error(`${this.constructor.name}:_fetch() not implemented!`)
  }

  _abort(){
    this.batcher.abort()
    this.abort()
    return this.send({to: 'adapter', args: {type: ResponseType.complete, result: null, hash: 'abort'}})
  }

  //override.
  abort(){}

  abortControllerReset(){
    this._controller = new AbortController();
    this._signal = this._controller.signal;
  }

  respond(type: ResponseType, request: WebsocketRequestBody, result?: IEvent | IEvent[]){
    const { hash, options } = request;
    const { cache, returnResults } = options;
    
    const response = {
      type, 
      result,
      hash: hash as string
    }

    if(cache === true) {
      this.send({to: 'cache', args: response})
    }
    if(returnResults === true){
      //console.log('respond to websocket adapter', hash, result instanceof Array? result.length : result)
      this.send({to: 'adapter', args: response})
    }
  }

  batchResponse(events: IEvent[], state?: WebsocketRequestBody, id?: string){
    if(!state) throw new Error('AdapterWebsocketWorker: batchResponse: state is undefined')
    this.respond(ResponseType.events, state, events)
  }

  requestCallbacks(request: WebsocketRequestBody = defaultWebsocketRequestBody): SubscribeHandlers {
    const { options, hash } = request
    const { batch } = options
    const onevent = (event: unknown) => {
      let result: IEvent | IEvent[];
      if(typeof batch === 'number') {
        const state = !this.batcher.hasState(hash) ? request : undefined
        this.batcher.add(event as IEvent, hash, state)
      }
      else {
        result = event as IEvent;
        this.respond(ResponseType.event, request, event as IEvent)
      }
    }
    const oneose = () => {
      // this.respond(ResponseType.complete, request)
    }
    return { onevent, oneose }
  }

  requestSyncResponse(request: WebsocketRequestBody, result: IEvent[]){
    const { hash, options } = request
    const { cache, returnResults } = options
    let args: WebsocketResponseBody = {
      type: ResponseType.events, 
      result,
      hash: hash as string
    }
    if(cache === true) {
      this.send({to: 'cache', args})
    }
    if(returnResults === true){
      this.send({to: 'adapter', args})
    }
    //complete message.
    args = {
      ...defaultWebsocketResponseBody,
      result: result.length > 0,
      type: ResponseType.complete,
      hash: hash as string
    }
    if(cache === true) {
      this.send({to: 'cache', args})
    }
    // if(returnResults === true){
      //always send complete?
      this.send({to: 'adapter', args})
    // }
  }

  private _getUniquePubkeys(events: IEvent[]): string[] {
    return Array.from(new Set(events.map(event => event.pubkey)))
  }
 }