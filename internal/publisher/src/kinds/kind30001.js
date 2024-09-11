import { Publisher } from '../Publisher.js'

const KIND = 30001

export class Kind30001 extends Publisher {
  constructor(){
    super(KIND)
    this.kind = KIND
  }

  _generateEvent(data){
    let tags = []
    const content = Kind0.generateContent(data)
    
    const event = {
      ...this.tpl(),
      content,
      tags
    }

    return event
  }


  static generateContent(){
    return ""
  }

  static generateTags(data){
    const tags = []
    tags.push(['d', `relays?${data.page}`])
    tags.push(['description', 'these are relays that have been scraped from notes. These relays may or may not be valid.'])
    data.forEach( relay => {
      tags.push([ 'relay', new URL(relay).toString() ])
    })
  }

  static parse(event){
    return JSON.parse(event.content)
  }
}