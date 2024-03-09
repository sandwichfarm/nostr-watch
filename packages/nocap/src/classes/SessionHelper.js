import murmurhash from 'murmurhash' 
import { random } from '../utils.js'

export class SessionHelper {  
  constructor(url){
    this.url = url
    this.init()
    this.initial = true 
  }

  init(){
    this.salt = murmurhash.v3(random(50)) 
    this.id = {}
    this.id.session = murmurhash.v3('session', this.salt)
    this.id.open = murmurhash.v3('open', this.salt)
    this.id.read = murmurhash.v3('read', this.salt)
    this.id.write = murmurhash.v3('write', this.salt)
    this.id.info = murmurhash.v3('info', this.salt)
    this.id.geo = murmurhash.v3('geo', this.salt)
    this.initial = false
    return this.id
  }

  create(){
    return this.init() 
  }

  get(key){
    if(!key || !this?.id?.[key])
      return this.id.session
    return this.id[key]
  } 
}