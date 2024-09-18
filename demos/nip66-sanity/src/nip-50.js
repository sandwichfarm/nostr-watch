import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool'
import { Relay, useWebSocketImplementation as useWebSocketImplementation2 } from 'nostr-tools/relay'
import WebSocket from 'ws'
useWebSocketImplementation(WebSocket)
useWebSocketImplementation2(WebSocket)

const relay66 = new SimplePool()

let relays = ['wss://relay.nostr.watch', 'wss://relaypag.es', 'wss://monitorlizard.nostr1.com']

let nip50Relays = []

let h = relay66.subscribeMany(
  relays,
  [
    {
      authors : ['9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923', '9ba6484003e8e88600f97ebffd897b2fe82753082e8e0cd8ea19aac0ff2b712b'],
      kinds: [30166],
      "#N": ["50"],
      since: Math.round(Date.now() / 1000) - 60 * 60 * 1.5,
    },
  ],
  {
    onevent(event) {
      const relay = event.tags.find(tag => tag[0] === 'd')?.[1]
      if(!relay) return console.error('No relay d tag found')
      console.log(`found nip50 relay: ${relay}`)
      nip50Relays.push(relay)
    },
    oneose() {
      console.log(`nip66: eose, found ${nip50Relays.length} nip50 relays`)
      h.close()
      testNip50()
    }
  }
)

let nip50Results = 0

const testNip50 = async () => {
  const subs = {}
  const results = {}
  const search = "nostr"
  const filters = [
    { search, limit: 1  }
  ]

  const prom = []

  for(const relay of nip50Relays) {
    prom.push(new Promise( async (resolve) => {
      const _relay = await Relay.connect(relay).catch(console.error)
      if(!_relay?.subscribe) {
        results[relay] = false
        return resolve()
      }
      let found = false;
      subs[relay] = _relay.subscribe(
        filters,
        {
          onevent(event) {
            found = true; 
            console.log(`${relay}: ${event.content.includes(search)}`)
            results[relay] = event.content.includes(search)
          },
          oneose() {
            if(!found) {
              results[relay] = false
              console.log(`${relay}: false`)
            }
            subs[relay].close()
            resolve()
          }
        }
      )
    }))
  }

  await Promise.all(prom)

  Object.entries(results).forEach(([relay, result]) => {
    console.log(`relay ${relay} returned ${result}`)
    if(result) nip50Results++
  })

  console.log(`success: ${nip50Results} / ${nip50Relays.length}`)
}