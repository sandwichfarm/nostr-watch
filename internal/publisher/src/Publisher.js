import { chunkArray } from '@nostrwatch/utils'
import Logger from '@nostrwatch/logger'
import wsAdapter from './adapters/default.js'

export class Publisher { 

  event = null
  pubkey = null

  constructor(pubkey, relays, config){
    this.logger = new Logger(`@nostrwatch/publisher: ${pubkey}`)
    this.pubkey = pubkey
    this.relays = relays
    this.ws = config?.wsAdapterInstance? config.wsAdapterInstance: new wsAdapter(relays)
  }

  async publishEvent(signedEvent){
    return this.ws.publish(signedEvent).catch( e => { this.logger.warn(`Publisher::publishEvent(): Error: ${e}`) })
  }

  async publishEvents(signedEvents){
    let publishes = []
    for await ( const signedEvent of signedEvents ) {
      const pub = await this.publishEvent(signedEvent).catch( this.logger.warn )
      publishes.push( pub )
    }
    return publishes
  }
}