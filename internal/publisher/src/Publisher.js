import { validateEvent, verifySignature, getSignature, getEventHash, SimplePool } from 'nostr-tools'
import Logger from '@nostrwatch/logger'
import { loadConfig, chunkArray } from '@nostrwatch/utils'

const config = await loadConfig()

import fs from 'fs/promises';

async function writeObjectToFile(obj) {

  let filename = obj.tags.find( tag => tag[0] === 'd' )[1].replace('wss://', '').replace('ws://', '').replace('http://', '').replace('https://', '').replace('/', '')
  filename = `${obj.kind}-${filename}`
  
  const fileName = `./.events/${filename}.json`;
  const jsonContent = JSON.stringify(obj, null, 2); // pretty-print JSON

  try {
    await fs.writeFile(fileName, jsonContent);
  } catch (error) {
    console.error('Error writing file:', error);
  }
}


export class Publisher { 

  constructor(key){
    this.logger = new Logger(`@nostrwatch/publisher: ${key}`)
  }

  tpl(){
    if(typeof this?.kind === 'undefined' || this.kind === null)
      throw new Error('tpl(): this.kind must be defined')
    return {
      pubkey: process.env.DAEMON_PUBKEY,
      kind: this.kind,
      content: "",
      tags: [],
      created_at: Math.round(Date.now()/1000)
    }
  }

  generateEvent(data){
    data
    return this.tpl(30166)
  }

  generateEvents(relays){
    const unsignedEvents = []
    relays.forEach( relay => {
      unsignedEvents.push(this.generateEvent(relay))
    })
    return unsignedEvents
  }

  signEvent(event){
    try {
      event.id = getEventHash(event)
      event.sig = getSignature(event, process.env.DAEMON_PRIVKEY || "")
      const valid = validateEvent(event) && verifySignature(event)
      if(!valid)
        throw new Error('generateEvent(): event does not validate')  
      return event
    } catch(e) {
      this.logger.err(`signEvent(): Error: ${e}`)
      this.logger.info(event)
    }
  }

  signEvents(unsignedEvents){
    const signedEvents = []
    unsignedEvents.forEach( event => {
      signedEvents.push(this.signEvent(event))
    })
    return signedEvents
  }

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
  
  constructor(key="generic"){
    super(key)
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
    if(!relay?.url) throw new Error('one(): relay must have a url property')
    if(!config.publisher?.to_relays) throw new Error('one(): config.publisher.to_relays is not configured')
    this.logger.debug(`one(): attempting to publish event for relay ${relay.url} to ${JSON.stringify(config.publisher?.to_relays)} relays`)
    const unsignedEvent = this.generateEvent(relay)
    const signedEvent = this.signEvent(unsignedEvent)
    await this.publishEvent(signedEvent)
    this.logger.debug(`one(): published event`)
  }

}