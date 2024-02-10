import { validateEvent, verifySignature, getSignature, getEventHash, SimplePool } from 'nostr-tools'
import Logger from '@nostrwatch/logger'
import { loadConfig, chunkArray } from '@nostrwatch/utils'

const config = await loadConfig()

import fs from 'fs/promises';

const log = new Logger('publisher')

async function writeObjectToFile(obj) {

  let filename = obj.tags.find( tag => tag[0] === 'd' )[1].replace('wss://', '').replace('ws://', '').replace('http://', '').replace('https://', '').replace('/', '')
  filename = `${obj.kind}-${filename}`
  
  const fileName = `./.events/${filename}.json`;
  const jsonContent = JSON.stringify(obj, null, 2); // pretty-print JSON

  try {
    await fs.writeFile(fileName, jsonContent);
    // console.log(`File ${fileName} has been written.`);
  } catch (error) {
    console.error('Error writing file:', error);
  }
}

export class Publisher { 

  constructor(){
    this.logger = new Logger('publisher')
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
      await this.publishEvents(signedEvents).catch(console.error)
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

  tpl(){
    if(!this?.kind)
      throw new Error('tpl(): this.kind must be defined')
    return {
      pubkey: process.env.DAEMON_PUBKEY,
      kind: this.kind,
      content: "",
      tags: [],
      created_at: Math.round(Date.now()/1000)
    }
  }

  generateEvent(){
    this.logger.warn('generateEvent(): has not been implemented by subclass, generating a blank event')
    return this.tpl(30066)
  }

  generateEvents(relays){
    const unsignedEvents = []
    relays.forEach( relay => {
      unsignedEvents.push(this.generateEvent(relay))
    })
    return unsignedEvents
  }

  signEvent(unsignedEvent){
    const signedEvent = unsignedEvent
    signedEvent.id = getEventHash(signedEvent)
    signedEvent.sig = getSignature(signedEvent, process.env.DAEMON_PRIVKEY)
    const valid = validateEvent(signedEvent) && verifySignature(signedEvent)
    if(!valid)
      throw new Error('generateEvent(): event does not validate')  
    // if(signedEvent.tags.filter( tag => tag[0]==='s' && tag[1]==='online' ).length > 0) console.log(signedEvent)
    return signedEvent
  }

  signEvents(unsignedEvents){
    const signedEvents = []
    unsignedEvents.forEach( event => {
      signedEvents.push(this.signEvent(event))
    })
    return signedEvents
  }

  async publishEvent(signedEvent){
    writeObjectToFile(signedEvent);
    console.log
    const pool = new SimplePool();
    const relays = config.publisher.to_relays
    let pubs = pool.publish(relays, signedEvent)
    await Promise.all( pubs )
    // console.log(pubs)
    // process.exit()
    return Promise.all( pubs )
  }

  async publishEvents(signedEvents){
    let publishes = []
    for await ( const signedEvent of signedEvents ) {
      publishes.push( await this.publishEvent(signedEvent) )
    }
    return publishes
  }
}