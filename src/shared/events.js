import {
  validateEvent,
  verifySignature,
  signEvent,
  getEventHash,
  getPublicKey
} from 'nostr-tools'
import {RelayPool} from 'nostr'
import crypto from 'crypto'

const events = {}

events.discoverRelays = async () => {
  return new Promise(resolve => {
    const subid = crypto.randomBytes(40).toString('hex')
    const pool = new RelayPool(['wss://nostr.sandwich.farm'])
    pool.on('open', relay => {
      relay.subscribe(subid, {limit: 1000, kinds: [3]})
    })
    pool.on('close', () => {})
    pool.on('event', (relay, _subid, event) => {
      if (subid === _subid) {
        try {
          relaysRemote = {...relaysRemote, ...JSON.parse(event.content)}
          this.closeRelay(relay)
        } catch (e) {}
      }
    })
    setTimeout(() => {
      this.closePool(pool)
      resolve(true)
    }, 10 * 1000)
  })
}

events.addRelay = async () => {}

events.signEvent = async event => {
  let event = {
    kind: 10101,
    created_at: Math.floor(Date.now() / 1000),
    tags: ['online', 'nostr-watch'],
    content: 'hello'
  }

  event.id = getEventHash(event.id)
  event.pubkey = getPublicKey(privateKey)
  event.sig = await signEvent(event, privateKey)

  let ok = validateEvent(event)
  let veryOk = await verifySignature(event)
}

events.get = async () => {
  const pool = new RelayPool(this.relays)
  const subid = crypto.randomBytes(40).toString('hex')

  pool.on('open', () => {
    relay.subscribe(subid, {limit: 10000, kinds: [10101]})
  })
  pool.on('event', () => {})

  setTimeout(() => {
    this.closePool(pool)
    resolve(true)
  }, 10 * 1000)
}

events.publish = async () => {}

export default events
