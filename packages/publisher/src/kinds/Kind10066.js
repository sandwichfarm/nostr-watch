import { Publisher } from '../Publisher.js'

export class Kind10066 extends Publisher {
  constructor(){
    super()
    this.kind = 10066
  }

  generateEvent(relay){
    const eventTpl = this.tpl()
    const tags = []

    // const { url, kinds, parameters, geo,  } = publisher

    if(kinds)
      kinds.forEach( kind => tags.push(['kind', kind]) )

    if(url)
      tags.push(['url', url, ])

    if(parameters instanceof Object)
      tags.push(['parameters', JSON.stringify(parameters)])

    if(geo)
      if(typeof geo === 'string')
        tags.push(['g', geo])
      else if(typeof geo === 'array')
        geo.forEach( g => tags.push(['g', g]) )
    
    const event = {
      ...eventTpl,
      tags
    }

    return event
  }
}