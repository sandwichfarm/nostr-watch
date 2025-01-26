import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { validateEvent, getEventHash } from 'nostr-tools'

import Logger from '@nostrwatch/logger'

export class Event {

  pubkey = null
  logger = null

  constructor(kind, pubkey){
    this.pubkey = pubkey
    this.logger = new Logger(`@nostrwatch/publisher/event: ${kind}`)
  }

  tpl(data){
    if(typeof this?.kind === 'undefined' || this.kind === null)
      throw new Error('tpl(): this.kind must be defined')

    if(!this.pubkey)
      throw new Error('DAEMON_PUBKEY must be defined')

    const id = null
    const pubkey = this.pubkey  
    const kind = this?.kind ?? 1
    const created_at = data?.checked_at? data.checked_at: Math.round(Date.now()/1000)
    const content = data?.content ?? String("")
    const tags = data?.tags ?? []

    return { id, pubkey, kind, created_at, tags, content }
  }

  json(){
    return this.event
  }

  generateEvent(data){
    this.event = this._generateEvent(data)
    this.event.id = getEventHash(this.event)
    return this.event
  }

  _generateEvent(data){
    this.logger.warn('Publisher._generateEvent() is not defined')
    return this.tpl(data)
  }

  // generateEvents(events){
  //   const unsignedEvents = []
  //   events.forEach( event => {
  //     unsignedEvents.push(this.generateEvent(relay))
  //   })
  //   return unsignedEvents
  // }

  signEvent(privateKey){
    if(!this?.event) 
      throw new Error('signEvent(): this.event is not defined')
    try {
      this.event = finalizeEvent(this.event, privateKey || process.env.DAEMON_PRIVKEY)
      const valid = validateEvent(this.event) && verifyEvent(this.event)
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
}