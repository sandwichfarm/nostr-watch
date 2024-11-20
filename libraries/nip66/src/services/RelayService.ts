import { IWebsocketAdapter } from '@core/WebsocketAdapter';
import { ICacheAdapter } from '@core/CacheAdapter';
import { IAdaptersArgument } from '@interfaces/IAdaptersArgument';
import { EventEmitter } from 'tseep';
import { Service } from './Service';

export class RelayService extends Service {

  constructor( adapters: IAdaptersArgument, emitter: EventEmitter ){
    super(adapters, emitter)
  }
}