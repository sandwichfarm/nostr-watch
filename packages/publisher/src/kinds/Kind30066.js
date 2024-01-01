import { Publisher } from '../Publisher.js'

export class Kind30066 extends Publisher { 
  constructor(){
    super()
    this.kind = 30066
  }

  generateEvent(relay){
    if(!relay?.url)
      throw new Error('generateEvent(): relay must have a url property')

    const eventTpl = this.tpl()
    const tags = []

    tags.push(['d', relay?.url])

    if(relay?.network)
      tags.push(['n', relay?.network])

    if(relay?.rtt && relay?.rtt instanceof Array)
      relay.rtt.forEach( rtt => tags.push(['rtt', rtt.shift(), ...rtt.map(String)]) )

    if(relay?.ssltag)
      tags.push(relay.ssltag)

    if(relay?.geo)
      relay?.geo.forEach( geo => tags.push(geo) )

    if(relay?.labels){
      relay.labels.forEach(labels => {
        const key = labels.shift()
        tags.push(['L', key])
        labels.forEach(label => tags.push(['l', label, key]))
      })
    }

    if(relay?.nips && relay?.nips instanceof Array)
      relay.nips.forEach( nip => tags.push(['N', `${nip}`]) )

    const event = {
      ...eventTpl,
      tags
    }

    return event
  }
}