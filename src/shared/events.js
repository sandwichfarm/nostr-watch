import { getEventHash, getPublicKey, signEvent } from 'nostr-tools'

import { RelayPool } from 'nostr'
import crypto from 'crypto';
import { useUserStore } from '@/store/user'

const store = useUserStore()

const events = {}

events.discoverRelays = async function(){
  return new Promise(resolve => {
    const subid = crypto.randomBytes(40).toString('hex')
    const pool = RelayPool(['wss://nostr.sandwich.farm'])
    pool
      .on('open', relay => {
        //console.log('open')
        relay.subscribe(subid, {limit: 1000, kinds:[3]})
      })
      .on('close', () => {
        //console.log('close')
      })
      .on('event', (relay, _subid, event) => {
        if(subid == _subid) {
          try { 
            relaysRemote = Object.assign(relaysRemote, JSON.parse(event.content))
            this.closeRelay(relay)
          } catch(e) {""}
        }
      })
    setTimeout( () => {
      this.closePool(pool)
      resolve(true) 
    }, 10*1000 )
  })
}

events.addRelay = async function(){
  
}

events.signEvent = async function(event) {
  let newEvent = {
    kind: 10101,
    created_at: Date.now(),
    tags: ["online", "nostr-watch"],
    content: 'hello'
  }

  newEvent.id = getEventHash(event.id);
  newEvent.pubkey = getPublicKey();
  newEvent.sig = await signEvent(newEvent, store.getPublicKey);

  // let ok = validateEvent(newEvent);
  // let veryOk = await verifySignature(newEvent);
}

events.get = async function (){
  const pool = new RelayPool(this.relays),
        subid = crypto.randomBytes(40).toString('hex')

  pool
    .on('open', relay => {
      relay.subscribe(subid, {limit: 10000, kinds:[10101]})
    })
    .on('event', () => {

    })

  setTimeout( () => {
    this.closePool(pool)
  }, 10*1000 )
}

events.publish = async function (){

}

export default events;