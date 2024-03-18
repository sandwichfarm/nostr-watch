import { Publisher } from '../Publisher.js'

export class Kind0 extends Publisher {
  constructor(){
    super()
    this.kind = 0
    this.discoverable = { pubkey: true }
    this.human_readable = false
    this.machine_readable = true
  }

  generateEvent(data){
    let tags = []
    const content = Kind0.generateContent(data)
    
    const event = {
      ...this.tpl(),
      content,
      tags
    }

    return event
  }


  static generateContent(data){
    let content = ""
    try{
      content = JSON.stringify(data)
    }
    catch(e){
      console.dir(`Kind0::generateContent(): Error: ${e}`)
      throw new Error('Was not able to stringify data for kind 0 content field.')
    }
    return content 
  }

  static parse(event){
    return JSON.parse(event.content)
  }
}