import { IWebSocketAdapter, IWebsocketAdapterCallbacks } from '@base/interfaces/IWebsocketAdapter';
import { Adapter } from '@base/Adapter';
import { INostrEvent } from '@base/interfaces/INostrEvent';

import { SimplePool, type Filter } from 'nostr-tools';

import jwtEncode from 'jwt-encode'

export class NostrToolsAdapter extends Adapter implements IWebSocketAdapter {
  static slug = "nostrtools"
  private relays?: string[];
  private _pool?: SimplePool;
  private subs: Map<string, any> = new Map();
  private _callbacks?: IWebsocketAdapterCallbacks = {};
  private _salt: string = 'nip66'

  constructor() {
    super()
  }

  get pool(): SimplePool | undefined {  
    return this._pool;
  }

  get callbacks(): IWebsocketAdapterCallbacks | undefined {
    return this._callbacks;
  }

  async connect(url: string): Promise<void> {
    if(!this?.pool){
      this._pool = new SimplePool();
    }
  }

  subscribe(filters: Filter[], subId: string = jwtEncode(filters, this._salt)): string | undefined {
    if(this._validateRequest()) return undefined
    const params: any = {}
    if(this.callbacks?.onEvent) {
      params.onevent = (event: Event) => (this.callbacks?.onEvent as unknown as Function)(event as unknown as INostrEvent)
    }
    if(this.callbacks?.onEose) {
      params.oneose = () => (this.callbacks as unknown as Function)?.onEose()
    }
    if(this.callbacks?.onClose) {
      params.onclose = () => (this.callbacks as unknown as Function)?.onClose()
    }
    const sub = (this.pool as SimplePool).subscribeMany(
      this.relays as string[],
      filters,
      params
    )
    this.subs.set(subId, sub);
    return subId
  }

  async getEvents(filter: Filter): Promise<INostrEvent[] | undefined> {
    if(!this._validateRequest()) return
    const events = await (this.pool as SimplePool).querySync(this.relays as string[], filter)
    return events as unknown as INostrEvent[];
  }

  async getEvent(filter: Filter): Promise<INostrEvent | undefined> {
    if(!this._validateRequest()) return
    const event = await (this.pool as SimplePool).get(this.relays as string[], filter)
    return event as unknown as INostrEvent;
  }

  unsubscribe(subId: string): void {
    this.subs.get(subId).close();
    this.subs.delete(subId);
  }

  disconnect(): void {
    if(!this._validateRequest()) return
    this.pool?.close(this.relays as string[]);
  }

  terminate(): void {
    if(!this._validateRequest()) return
    this.pool?.close(this.relays as string[]);
  }

  private _validateRequest(): boolean {
    if(!this.pool) {
      console.error('No pool available');
      return false
    }
    if(!this.relays) {
      console.error('No relays available');
      return false
    }
    return true
  }
}