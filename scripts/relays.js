const { RelayPool, Relay } = require('nostr'),
      crypto = require('crypto'),
      writeYamlFile = require('write-yaml-file'),
      fs = require('fs'),
      fetch = require('cross-fetch'),
      yaml= require('js-yaml');

const result = {},
      relays_endpoint = 'https://nostr.watch/relays.json'

let   relays = [],
      relaysKnown = [],
      relaysRemote = {},
      remove = [],
      uniques = null

const run = async function(){
  //discover relays [kind:3], "remoteRelays"
  await discover().catch( err => console.warn(err) )

  //Sanitize knownRelays to prevent dupes in uniques
  sanitizeKnownRelays()

  //sanitize remoteRelays
  sanitizeRemoteRelays()

  //check remoteRelays
  await checkRemoteRelays()

  //Remove offline remoteRelays
  removeOfflineRelays()

  //Combine knownRelays and remoteRelays
  concatRelays()

  //set uniques
  uniques = new Set(relays)

  //Write to file
  await writeYamlFile('./relays.yaml', { relays: Array.from(uniques) })

  process.exit()

}

const concatRelays = function(){
  relays = relaysKnown.concat(relaysRemote)
}

async function getRelays(){
  // return await fetch(relays_endpoint, { method: "Get" })
  //   .then(res => res.json())
  //   .then(json => relaysKnown = json.relays) 
  const relaysObj = yaml.load(fs.readFileSync('./relays.yaml', 'utf8'))
  relaysKnown = relaysObj.relays
  //console.log(relaysKnown)
  return 
}

async function discover(){
  await getRelays()

  return new Promise(resolve => {
    const subid = crypto.randomBytes(20).toString('hex')
    const pool = RelayPool(relaysKnown)
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
      pool.close()
      resolve(true) 
    }, 10*1000 )
  })
}

const sanitizeRemoteRelays = function(){
  remote1 = Object.entries(relaysRemote)
              .filter( relay => Array.isArray(relay) )
              .map( relay => sanitizeRelay(relay[0]) )
              .filter( relay => relay.startsWith('wss://') )
              .filter( relay => !relay.includes('localhost') )

  remote2 = Object.entries(relaysRemote)
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
          .replace(/\r?\n|\r/g, "")
          .replace(/\/+$/, '')
          .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, '');
}

const checkRemoteRelays = async function(){
  const randomlyOrderedRelays = relaysRemote.sort(() => Math.random() - 0.5)

  for(let i=0;i<randomlyOrderedRelays.length;i++) {
    //console.log('check for connect', remoteMerged[i])
    await checkRelay(randomlyOrderedRelays[i])
            .catch( () => {
              remove.push(randomlyOrderedRelays[i])
              //console.log('removals:', remove.length, randomlyOrderedRelays[i])
            })
  }
}

const checkRelay = async function(relay){
  return new Promise( (resolve, reject) => {
    let socket = new Relay(relay)
        socket
          .on('open', relay => {
            socket.close()
            resolve()
          })
          .on('error', reject )
    setTimeout( reject, 500 )
  })
}

const removeOfflineRelays = function(){
  relaysRemote = relaysRemote.filter( relay => !remove.includes(relay) )
}

run()
