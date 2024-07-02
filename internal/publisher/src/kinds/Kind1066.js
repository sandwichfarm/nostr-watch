import { Publisher } from '../Publisher.js'

export class Kind1066 extends Publisher {
  constructor(){
    const KIND = 1066
    super()
    this.kind = KIND
  }
}import { Publisher } from '../Publisher.js'

export class Kind1066 extends Publisher {
  constructor(){
    const KIND = 1066
    super(KIND)
    this.kind = KIND
    this.discoverable = { pubkey: true }
    this.human_readable = false
    this.machine_readable = true
  }

  generateEvent(data){
    let tags = Kind1066.generateTags(data)  
    const event = {
      ...this.tpl(),
      tags
    }
    return event
  }

  static generateTags(data){
    if( !(relays instanceof Object) )
      throw new Error("Kind1066: generateTags(data): data should be an object")
    let tags = []    

    tags.push(['r', data.url])

    const aTag = ['a', `30066:${data.pubkey}:${data.url}`]
    if(data?.relayHint)
      aTag.push(data.relayHint)
    tags.push(aTag)

    const deltas = data.deltas
                      .map( delta => [ ['D', delta.key], [delta.key, delta.value] ] )
                      .reduce( (acc, val) => [...acc, ...val], [] )

    tags = [ ...tags, ...deltas ]
  }

  parse(event){
    return {
      relays: event.tags.filter( tag => tag === 'r' ).map( tag => tag[1] )
    }
  }  
}