import { Kind30166 } from './Kind30166.js';  

export class Kind30166Child extends Kind30166 { 
  constructor(pubkey){
    super(pubkey)
  }

  generateTags(check){
    let tags = []
    tags.push(['d', check.url])
    tags.push(['a', `30166:${this.pubkey}:${check.parent}`])
    return tags
  }
}