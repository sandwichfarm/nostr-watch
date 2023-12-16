import { Publisher } from '../Publisher.js'

export class Kind30066 extends Publisher { 
  constructor(){
    super()
  }

  generateEvent(relay){
    if(!relay?.url)
      throw new Error('generateEvent(): relay must have a url property')
    const eventTpl = this.tpl(30066)
    const tags = []
    tags.push(['d', relay?.url])

    if(relay?.online)
      tags.push(['s', relay?.online? 'online' : 'offline'])

    if(relay?.network)
      tags.push(['n', relay?.network])

    if(relay?.geo)
      if(typeof relay?.geo === 'string')
        tags.push(['g', relay?.geo])
      else if(typeof relay?.geo === 'array')
        relay?.geo.forEach( geo => tags.push(['g', geo]) )

    if(relay?.attributes)
      relay?.attributes.forEach( attribute => tags.push(['t', attribute]) )

    if(relay?.retries)
      tags.push(['retries', relay?.retries])

    const event = {
      ...eventTpl,
      tags
    }
    return event
  }
}