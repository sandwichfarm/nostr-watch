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

export class PublisherNocap extends Publisher {
  
  constructor(key="generic", pubkey){
    super(key, pubkey)
    this.logger = new Logger('publisher[nocap]')
  }

  async many(relays, privateKey){
    this.logger.debug(`many(): attempting to publish ${relays.length} events to ${JSON.stringify(this.relays)} relays`)
    if(!(relays instanceof Array)) throw new Error('many(): relays must be an array')
    const relaysChunks = chunkArray(relays, 50)
    let count = 0
    for await ( const chunk of relaysChunks ) {
      let signedEvents = []
      this.logger.debug(`publishEvents(): publishing ${chunk.length} events from chunk ${count++}/${relaysChunks.length}`)
      for ( const relay of chunk ) {
        this.generateEvent(relay)
        signedEvents.push(this.signEvent(privateKey))
      }
      try {
        await this.publishEvents(signedEvents).catch( e => { this.logger.error(`PublisherNocap::many(): Error: ${e}`) })
      }
      catch(e) {
        this.logger.error(`PublisherNocap::many(): Error: ${e}`)
      }
    }
  }

  async one(relay, privateKey){
    if(!relay?.url) 
      throw new Error('one(): relay must have a url property')
    
    this.logger.debug(`one(): attempting to publish event for relay ${relay.url} to ${JSON.stringify(this.relays)} relays`)
    
    this.generateEvent(relay)
    const signedEvent = this.signEvent(privateKey)

    try {
      await this.publishEvent(signedEvent)
        .then( () => {
          this.logger.debug(`one(): published event`)
        })
        .catch( e => {
          this.logger.error(`one(): Error: ${e}`)
        })
    }
    catch(e) {
      this.logger.error(`one(): Error: ${e}`)
    }
    
    return signedEvent.id
  }

}