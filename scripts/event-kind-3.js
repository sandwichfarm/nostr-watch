const { RelayPool, Relay } = require('nostr'),
      crypto = require('crypto'),
      writeYamlFile = require('write-yaml-file'),
      fs = require('fs'),
      fetch = require('cross-fetch')


const result = {},
      relays_endpoint = 'https://nostr.watch/relays.json'

const subid = crypto.randomBytes(40).toString('hex')

let   relays = [],
      relaysRemote = {}

async function getRelays(){
  return await fetch(relays_endpoint, { method: "Get" })
    .then(res => res.json())
    .then(json => relays = json.relays) 
}

async function run(){
  await getRelays()

  return new Promise(resolve => {
    const pool = RelayPool(relays)
    pool
      .on('open', relay => {
        // console.log('open')
        relay.subscribe(subid, {limit: 500, kinds:[3]})
      })
      .on('close', () => {
        // console.log('close')
      })
      .on('event', (relay, _subid, event) => {
        if(subid == _subid) {
          try { 
            relaysRemote = Object.assign(relaysRemote, JSON.parse(event.content))
            // console.log( event.content ) 
          } catch(e) {""}
        }
      })

    setTimeout( () => {
      pool.close()
      resolve(true) 
    }, 2*1000 )

  })
}

run()
  .then( async () => {
    
    remote1 = Object.entries(relaysRemote)
              .filter( relay => Array.isArray(relay) )
              .map( relay => relay[0].toLowerCase().trim().replace('\t', '').replace(/\s\t/g, "") )
              .filter( relay => relay.startsWith('wss://') )
              .filter( relay => !relay.includes('localhost') )

    remote2 = Object.entries(relaysRemote)
              .filter( relay => typeof relay === 'String' )
              .map( relay => relay.toLowerCase().trim().replace('\t', '').replace(/\s\t/g, "") )
              .filter( relay => relay.startsWith('wss://') )
              .filter( relay => !relay.includes('localhost') )


    let remoteMerged = remote1.concat(remote2)

    // console.log(remoteMerged)

    const check = async function(relay){
      return new Promise( (resolve, reject) => {
        let socket = new Relay(relay)
            socket
              .on('open', resolve )
              .on('error', reject )
        setTimeout( reject, 1000)
      })
    }

    let remove = []

    for(let i=0;i<remoteMerged.length;i++) {
      // console.log('check for connect', remoteMerged[i])
      await check(remoteMerged[i]).catch( (err) => {
          // console.log(err)
          remove.push(remoteMerged[i])
          console.log('removals:', remove.length, remoteMerged[i])
        })
    }

    console.log('before check', remoteMerged.length)
    remoteMerged = remoteMerged.filter( relay => { 
      return !remove.includes(relay) 
    })
    console.log('after check', remoteMerged.length)

    const merged = relays.concat(remoteMerged)

    const uniques = Array.from(new Set(merged))

    console.log('after concat', uniques.length)

    let final = { relays: uniques }

    // console.log(final)


    await writeYamlFile('./relays.yaml', final)

    process.exit()

    
  })
  .catch( err => console.warn(err) )

