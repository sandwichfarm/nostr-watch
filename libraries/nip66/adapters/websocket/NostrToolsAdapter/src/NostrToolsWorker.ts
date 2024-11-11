import {  WorkerOptions, AdapterWorkerResult, AdapterWebsocketWorker, IAdapterWebsocketWorker, AdapterWebsocketWorkerCommand } from "@nostrwatch/nip66/core"

import { IEvent } from "@nostrwatch/nip66/interfaces";

import { applyMixins } from '@nostrwatch/nip66/utils'
import { NostrToolsMethods } from './NostrToolsMethods'
import { Filter } from "nostr-tools";
import { AdapterWorkerResultType } from "@nostrwatch/nip66/core";

interface NostrToolsWorkerCommand extends AdapterWebsocketWorkerCommand {}

interface NostrToolsWorkerResult extends AdapterWorkerResult {}

interface NostrToolsWorkerOptions extends WorkerOptions {
  relays?: string[]
}

const defaultRelays = ['wss://relaypag.es', 'wss://relay.nostr.watch', 'wss://purplepag.es', 'wss://user.kindpag.es']

export class NostrToolsWorker extends AdapterWebsocketWorker implements IAdapterWebsocketWorker {

  protected relays: string[] 

  constructor( options: NostrToolsWorkerOptions ){
    super(options)
    this.relays = options?.relays ? options.relays : defaultRelays
  }

  //begin: overload
  async setup(command: NostrToolsWorkerCommand): Promise<void> {
    //console.log('NostrToolsWorker: setup', command)
  }
  // async onMainThreadMessage(command: NostrToolsWorkerCommand): Promise<void> {"no need"}
  // async onChannelMessage(command: NostrToolsWorkerCommand): Promise<void> {"no need"}
  //end: overload

  //begin: adapter helper methods
  async subscribeAndCache(filters: Filter[] | Filter){
    console.log('NostrToolsWorker: subscribeAndCache', filters)
    const callbacks = {
      onevent: (event: IEvent) => {
        this.command('toChannel', AdapterWorkerResultType.event, event)
      }
    }
    await this._subscribe({filters, callbacks})
  }

  async subscribeAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>{
    console.log('NostrToolsWorker: subscribeAndReturnToAdapter', filters) 
    const callbacks = {
      onevent: (event: IEvent) => {
        this.command('toAdapter', AdapterWorkerResultType.event, event)
      }
    }
    return this._subscribe({filters, callbacks})
  }

  async subscribeAndCacheAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>{
    console.log('NostrToolsWorker: subscribeAndCacheAndReturnToAdapter', filters)
    const callbacks = {
      onevent: (event: IEvent) => {
        this.command('toChannel', AdapterWorkerResultType.event, event)
        this.command('toAdapter', AdapterWorkerResultType.event, event)
      }
    }
    return this._subscribe({filters, callbacks})
  }

  async subscribeAndCacheAndKeepOpen(filters: Filter[] | Filter): Promise<void>{
    console.log('NostrToolsWorker: subscribeAndCache', filters)
    const keepAlive = true
    const callbacks = {
      onevent: (event: IEvent) => {
        this.command('toChannel', AdapterWorkerResultType.event, event)
      }
    }
    // await this._subscribe({filters, callbacks})
    // filters = filters instanceof Array? filters: [filters]
    // filters = filters.map( (filter: Filter) => {
    //   filter.since = Math.round(Date.now()/1000)
    //   return filter
    // })
    await this._subscribe({filters, callbacks, keepAlive})
  }

  async fetchAndCache(filters: Filter[] | Filter): Promise<void>{
    console.log('NostrToolsWorker: fetchAndCache', filters)
    const events = await this.fetch(filters)
    this.command('toChannel', AdapterWorkerResultType.events, events)
  }

  async fetchAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>{
    console.log('NostrToolsWorker: fetchAndReturnToAdapter', filters)
    const events = await this.fetch(filters)
    this.command('toAdapter', AdapterWorkerResultType.events, events)
    return events
  }

  async fetchAndCacheAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>{
    console.log('NostrToolsWorker: fetchAndCacheAndReturnToAdapter', filters)
    const events = await this.fetch(filters)
    this.command('toChannel', AdapterWorkerResultType.events, events)
    this.command('toAdapter', AdapterWorkerResultType.events, events)
    
    return events
  }
}

export interface NostrToolsWorker extends NostrToolsMethods {}
applyMixins(NostrToolsWorker, [NostrToolsMethods]);