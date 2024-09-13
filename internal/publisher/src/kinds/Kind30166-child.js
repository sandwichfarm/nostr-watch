import { Kind30166 } from './kind30166.js';  

export class Kind30166Child extends Kind30166 { 
  constructor(){
    const KIND = 30166
    super(KIND)
  }

  static generateTags(check){
    let tags = []
    tags.push(['d', check.url])
    tags.push(['a', `30166:${this.pubkey}:${check.parent}`])
    return tags
  }
}