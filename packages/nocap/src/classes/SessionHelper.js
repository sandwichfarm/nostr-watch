import murmurhash from 'murmurhash' 
import { random } from '../utils.js'

export class SessionHelper {  
  constructor(){
    this.salt = null
    this.id = {}
    this.setup()
  }

  setup(){
    this.salt = Uint8Array.from(Array.from(random(20)).map(letter => letter.charCodeAt(0)));
    this.id.session = murmurhash.v3('session', this.salt)
    this.id.connect = murmurhash.v3('connect', this.salt)
    this.id.read = murmurhash.v3('read', this.salt)
    this.id.write = murmurhash.v3('write', this.salt)
    this.id.info = murmurhash.v3('info', this.salt)
    this.id.geo = murmurhash.v3('geo', this.salt)
  }

  new(){
    this.setup()
  }

  get(key){
    if(!key)
      return this.id.session
    return this.id[key]
  } 
}