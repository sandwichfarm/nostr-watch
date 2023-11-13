import { RelayPool } from 'nostr'
import crypto from 'crypto'

const History = async function(){

  let   relays = [],
        relaysKnown = [],
        relaysRemote = {},
        // remove = [],
        uniques = null,
        relayTimeCodes = {}

  const run = async function(){
    //discover relays [kind:3], "remoteRelays"
    await discover().catch( err => console.warn(err) )

    //Sanitize knownRelays to prevent dupes in uniques
    sanitizeKnownRelays()

    //sanitize remoteRelays
    sanitizeRemoteRelays()

    //check remoteRelays
    // await checkRemoteRelays()

    //Remove offline remoteRelays
    // removeOfflineRelays()

    //Combine knownRelays and remoteRelays
    concatRelays()

    //set uniques
    uniques = new Set(relays)

    //console.log(uniques, uniques.size)

    const final = []

    uniques.forEach( relay => {
      if( !(relayTimeCodes[relay] instanceof Array) ) 
        return 
      relayTimeCodes[relay].sort( (a, b) => a - b )
      final.push( [relay, relayTimeCodes[relay][0] ] )
    })

    //console.log('before sort', final[0])

    final.sort( (a, b) => a[1]-b[1] )

    //console.log('afdter sort', final[0])

    return final 
  }

  const concatRelays = function(){
    relays = relaysKnown.concat(relaysRemote)
  }

  const discover = async () => {
    relaysKnown = this.store.relays.getAll
    
    return new Promise(resolve => {
      let total = 0
      const subid = crypto.randomBytes(20).toString('hex')
      const pool = RelayPool(this.store.relays.getAll.filter( (relay) => this.store.results.get(relay)?.aggregate == 'public').filter( relay => this.store.results.get(relay)?.info?.supported_nips.includes(15)))
      pool
        .on('open', relay => {
          //console.log('open')
          relay.subscribe(subid, {since: 1609829, limit: 10000, kinds:[3]})
        })
        .on('eose', (relay) => {
          //console.log('closing', relay.url)
          this.closeRelay(relay)
          resolve(true)
        })
        .on('event', (relay, _subid, event) => {
          if(subid == _subid) {
            //console.log(total++)
            try { 
              //console.log(event)
              const parsed = JSON.parse(event.content)
              relaysRemote = Object.assign(relaysRemote, parsed)
              Object.keys(parsed).forEach( key => {
                if( !(relayTimeCodes[key] instanceof Array) )
                  relayTimeCodes[key] = new Array()
                relayTimeCodes[key].push(event.created_at)
              })
              this.closeRelay(relay)
            } catch(e) {
              console.error(e)
            }
          }
        })

      setTimeout( () => {
        this.closePool(pool)
        resolve(true) 
      }, 10*1000 )
    })
  }

  const sanitizeRemoteRelays = function(){
    const remote1 = Object.entries(relaysRemote)
                .filter( relay => Array.isArray(relay) )
                .map( relay => sanitizeRelay(relay[0]) )
                .filter( relay => relay.startsWith('wss://') )
                .filter( relay => !relay.includes('localhost') )

    const remote2 = Object.entries(relaysRemote)
                .filter( relay => relay instanceof String )
                .map( relay => sanitizeRelay(relay) )
                .filter( relay => relay.startsWith('wss://') )
                .filter( relay => !relay.includes('localhost') )

    relaysRemote = remote1.concat(remote2)
  }

  const sanitizeKnownRelays = function(){
    relaysKnown = relaysKnown.map( relay => sanitizeRelay(relay) ) //Known relays may have trailing slash
  }

  const sanitizeRelay = function(relay) {
    return relay
            .toLowerCase()
            .trim()
            .replace(/\s\t/g, '')
            .replace(/\/+$/, '')
            .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, '');
  }

  // const checkRemoteRelays = async function(){
  //   for(let i=0;i<relaysRemote.length;i++) {
  //     //console.log('check for connect', remoteMerged[i])
  //     await checkRelay(relaysRemote[i])
  //             .catch( () => {
  //               remove.push(relaysRemote[i])
  //               //console.log('removals:', remove.length, relaysRemote[i])
  //             })
  //   }
  // }

  // const checkRelay = async function(relay){
  //   return new Promise( (resolve, reject) => {
  //     let socket = new Relay(relay)
  //         socket
  //           .on('open', relay => {
  //             relay
  //             socket.close()
  //             resolve()
  //           })
  //           .on('error', reject )
  //     setTimeout( reject, 500 )
  //   })
  // }

  // const removeOfflineRelays = function(){
  //   relaysRemote = relaysRemote.filter( relay => !remove.includes(relay) )
  // }

  return run()
}

export default History