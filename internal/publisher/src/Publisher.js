import { validateEvent, verifySignature, getSignature, getEventHash, SimplePool } from 'nostr-tools'
import Logger from '@nostrwatch/logger'
import { loadConfig, chunkArray } from '@nostrwatch/utils'

const config = await loadConfig()

export class Publisher { 

  event = null
  pubkey = null

  constructor(key, pubkey){
    this.logger = new Logger(`@nostrwatch/publisher: ${key}`)
    this.pubkey = pubkey
  }

  tpl(data){
    if(typeof this?.kind === 'undefined' || this.kind === null)
      throw new Error('tpl(): this.kind must be defined')

    if(!this.pubkey)
      throw new Error('DAEMON_PUBKEY must be defined')

    const pubkey = this.pubkey  
    const kind = this?.kind ?? 1
    const created_at = data?.checked_at? data.checked_at: Math.round(Date.now()/1000)
    const content = data?.content ?? String("")
    const tags = data?.tags ?? []

    return { pubkey, kind, created_at, tags, content }
  }

  generateEvent(data){
    this.event = this._generateEvent(data)
    return this.event
  }

  _generateEvent(data){
    this.logger.warn('Publisher._generateEvent() is not defined')
    return {
      ...this.tpl(data)
    }
  }

  // generateEvents(events){
  //   const unsignedEvents = []
  //   events.forEach( event => {
  //     unsignedEvents.push(this.generateEvent(relay))
  //   })
  //   return unsignedEvents
  // }

  signEvent(){
    if(!this?.event) 
      throw new Error('signEvent(): this.event is not defined')
    try {
      this.event.id = getEventHash(this.event)
      this.event.sig = getSignature(this.event, process.env.DAEMON_PRIVKEY || "")
      const valid = validateEvent(this.event) && verifySignature(this.event)
      if(!valid)
        throw new Error('generateEvent(): event does not validate')  
      return this.event
    } catch(e) {
      this.logger.err(`signEvent(): Error: ${e}`)
      this.logger.info(this.event)
    }
  }

  // signEvents(unsignedEvents){
  //   const signedEvents = []
  //   unsignedEvents.forEach( event => {
  //     signedEvents.push(this.signEvent(event))
  //   })
  //   return signedEvents
  // }

  async publishEvent(signedEvent){
    const pool = new SimplePool();
    const relays = config.publisher.to_relays
    let pubs = pool.publish(relays, signedEvent)
    const res = await Promise.allSettled( pubs ).catch( e => { log.error(`publishEvent(): Error: ${e}`) } )
    pool.close(relays)
    return res
  }

  async publishEvents(signedEvents){
    let publishes = []
    for await ( const signedEvent of signedEvents ) {
      publishes.push( await this.publishEvent(signedEvent) )
    }
    return publishes
  }
}


export class PublisherNocap extends Publisher {
  
  constructor(key="generic", pubkey){
    super(key, pubkey)
    this.logger = new Logger('publisher[nocap]')
  }

  async many(relays){
    this.logger.debug(`many(): attempting to publish ${relays.length} events to ${JSON.stringify(config.publisher.to_relays)} relays`)
    if(!(relays instanceof Array)) throw new Error('many(): relays must be an array')
    const relaysChunks = chunkArray(relays, 50)
    let count = 0
    for await ( const chunk of relaysChunks ) {
      let signedEvents = []
      this.logger.debug(`publishEvents(): publishing ${chunk.length} events from chunk ${count++}/${relaysChunks.length}`)
      for ( const relay of chunk ) {
        const unsignedEvent = this.generateEvent(relay)
        signedEvents.push(this.signEvent(unsignedEvent))
      }
      await this.publishEvents(signedEvents).catch( e => { this.logger.error(`PublisherNocap::many(): Error: ${e}`) })
    }
  }

  async one(relay){
    if(!relay?.url) 
      throw new Error('one(): relay must have a url property')
    if(!config.publisher?.to_relays) 
      throw new Error('one(): config.publisher.to_relays is not configured')
    
    this.logger.debug(`one(): attempting to publish event for relay ${relay.url} to ${JSON.stringify(config.publisher?.to_relays)} relays`)
    
    const unsignedEvent = this.generateEvent(relay)
    const signedEvent = this.signEvent(unsignedEvent)

    await this.publishEvent(signedEvent)
      .then( () => {
        this.logger.debug(`one(): published event`)
      })
      .catch( e => {
        this.logger.error(`one(): Error: ${e}`)
      })
    
    return signedEvent.id
  }

}