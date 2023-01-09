require('dotenv').config()

const fs = require('fs'),
      yaml= require('js-yaml'),
      crypto = require('crypto'),
      nostrTools = require('nostr-tools'),
      { RelayPool } = require('nostr'),
      { validateEvent, verifySignature, signEvent, getEventHash, getPublicKey } = nostrTools,
    
      uniques = new Set()
      
let   relays = yaml.load(fs.readFileSync('./relays.yaml', 'utf8')).relays,
      canonicals = new Object(),
      missing = new Array(),
      hashes = new Object(),
      discovered = true,
      totalSent = 0,
      oks = 0, 
      notices = 0

const pool = RelayPool(relays, {reconnect: false})

pool
  .on('ok', (Relay) => {
    oks++
    // console.log('OK', Relay.url)
  })
  .on('notice', (Relay, notice) => {
    notices++
    // console.log('NOTICE', Relay.url, notice)
  })

async function run(){
  // setup()
  // deletions()
  // await process.exit()
  await discover()
  // process.exit()
  // console.log(`wtf`, relays.length)
  // console.log(`hashes`, Object.keys(hashes).length)
  await sieve()

  setInterval( ()=> {
    console.log('status', '\ntotal sent:', totalSent, '\noks:', oks, '\nnotices:', notices, '\n\n')
  }, 60000)
  await broadcast()

  
  process.exit()
    
}

function setup(){
  const event = {
    "id": "a2640e8a6640c595942ccf290eae404ac58569b59af5c8c8e3334d9cf809fff6",
    "pubkey": "b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6",
    "created_at": 1673275222,
    "kind": 1,
    "tags": [],
    "content": "&lt;3 to all the relays",
    "sig": "e536be52a04f95c54e5cc82caafb9b25c8d47e00182c0eac0b6b678b482710288cc7fd85c62b0f97f5ed33dfbd7e15555c9bfeac059794767e414666d807f9cf"
  }

  pool.send(['EVENT', event])
}

async function discover(){
  

  console.log('relays', relays.length)

  return new Promise(resolve => {
    const subid = crypto.randomBytes(40).toString('hex')
    
    pool
      .on('open', Relay => {
        console.log('open', Relay.url)
        Relay.subscribe(subid, {limit: relays.length, kinds:[1], "#t": ['canonical'], authors:[ getPublicKey(process.env.PRIVATE_KEY) ] }, )
        relays.forEach( relay => {
          hashes[hash(relay)] = relay
          // Relay.subscribe(`subid_${relay}`, {limit: 1, kinds:[1], authors:[ getPublicKey(process.env.PRIVATE_KEY) ] }, )
        })
        
      })
      .on('event', (Relay, _subid, event) => {
        if(!discovered){
          // console.log('published event found', event.id)
        }
        if(_subid.includes(subid) && discovered) {   
          // console.log('event', event.content, event.id)     

          if(uniques.has(event.id))
            return 

          const relayHash = event.tags.map( tag => tag[0]=='h' ? tag[1] : false )[0]

          if(!relayHash)
            return

          // console.log('relay hash', Relay.url, relayHash)

          const relay = hashes?.[relayHash]

          uniques.add(event.id)
          canonicals[relay] = event
        }
      })

    setTimeout( () => {
      // pool.close()
      discovered = false 
      resolve(relays) 
    }, 10*1000 )
  })
}

async function sieve(){
  console.log('filtering relays', relays.length)
  checkMissing()
  console.log('missing', missing.length)
  return
}

function checkMissing(){
  missing = new Array()
  relays.forEach( relay => {
    // console.log('check missing', relay, (canonicals?.[relay] instanceof Object) )
    if( !(canonicals?.[relay] instanceof Object) )
      missing.push(relay)
  })
}

async function broadcast(){
  for(let i=0;i<missing.length;i++){
    const relay = missing[i]
    const event = {
      created_at: Math.floor(Date.now()/1000),
      content: `<3 ${relay}, canonical note for https://nostr.watch/relay/${relay.replace('wss://', '')}`,
      kind: 1,
      tags: [
        ['h', hash(relay)],
        ['t', 'canonical'],
        ['e', process.env.CANONICAL_NOTE, 'wss://nostr.sandwich.farm']
      ] 
    }
    const signedEvent = await sign(event, relay)

    if(!signedEvent)
      return 

    // console.log("sending to pool", signedEvent)
    pool.send(['EVENT', signedEvent])
    totalSent++
    console.log('total sent, backlog', totalSent)
    await delay(60*1000)
  }
  console.log('finished.')
}

async function sign(event, relay){
  // console.log('event to sign', event)
  event.pubkey = getPublicKey(process.env.PRIVATE_KEY)
  event.id = getEventHash(event)
  event.sig = await signEvent(event, process.env.PRIVATE_KEY)

  let ok = validateEvent(event)
  let veryOk = await verifySignature(event)

  // if(relay)
  //   console.log('sign valid', relay, ':', ok, veryOk)
  // else 
  //   console.log('sign valid', ':', ok, veryOk)
  
  if( ok && veryOk )
    return event
  else 
    console.error('event is invalid', event)
}

async function deletions(){
  const tags = [
    ["e", "8e68215676f0bfcc386e3cc0d9e975e7fab1aed91d781c4ec3aac5f4c2c11e24"],
    ["e", "00834b0779cd0a87b6eeb5d25e22e887b007a30239a1e75cb567324a687e000b"],
    ["e", "783f57bfbeb3c4e1cd13cc493b021cb0c353ab98c1d02f5378dfdfb0afcc77fd"]
  ]

  const event = {
    "kind": 5,
    created_at: Math.floor(Date.now()/1000),
    "tags": tags,
    "content": "delete dev posts"
  }
  const signedEvent = await sign(event)

  if(!signedEvent)
    return 

  console.log("sending to pool", signedEvent)

  pool.send(['EVENT', signedEvent])

  return 
}

async function delay(ms) {
  return new Promise( resolve => setTimeout(resolve, ms) )
}

function hash(relay){
  return crypto.createHash('md5').update(relay).digest('hex');
}

run()