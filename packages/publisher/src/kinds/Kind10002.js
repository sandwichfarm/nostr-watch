import { Publisher } from '../Publisher.js'

export class Kind10002 extends Publisher {
  constructor(){
    super()
    this.kind = 10002
    this.discoverable = { pubkey: true }
    this.human_readable = false
    this.machine_readable = true
  }

  generateEvent(data){
    let tags = Kind10002.generateTags(data)  
    const event = {
      ...this.tpl(),
      tags
    }
    return event
  }

  static generateTags(relays){
    if( !(relays instanceof Array) )
      throw new Error("kind10002: generateTags(relays): relays should be an array")
    const tags = relays.map( relay => ['r', relay] )
    return tags
  }

  parse(event){
    return {
      relays: event.tags.filter(tag => tag === 'r').map( tag => tag[1] )
    }
  }
  
}