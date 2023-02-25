import {
  getEventHash,
  getPublicKey,
  signEvent,
  validateEvent,
  verifySignature
} from 'nostr-tools'

import {RelayPool} from 'nostr'
import crypto from 'crypto'

const events = {}

events.discoverRelays = async function () {
  return new Promise(resolve => {
    const subid = crypto.randomBytes(40).toString('hex')
    const pool = new RelayPool(['wss://nostr.sandwich.farm'])
    pool
      .on('open', relay => {
        relay.subscribe(subid, {limit: 1000, kinds: [3]})
      })
      .on('close', () => {})
      .on('event', (relay, _subid, event) => {
        if (subid === _subid) {
          try {
            relaysRemote = Object.assign(
              relaysRemote,
              JSON.parse(event.content)
            )
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

events.addRelay = async function () {}

events.signEvent = async function (event) {
  const timestamp = Math.floor(Date.now() / 1000)
  const eventHash = getEventHash(event.id)
  const publicKey = getPublicKey(privateKey)
  const signature = await signEvent(event, privateKey)

  const signedEvent = {
    kind: 10101,
    created_at: timestamp,
    tags: ['online', 'nostr-watch'],
    content: 'hello',
    id: eventHash,
    pubkey: publicKey,
    sig: signature
  }

  const isValid = validateEvent(signedEvent)
  const isVerified = await verifySignature(signedEvent)
}

events.get = async function () {
  const pool = new RelayPool(this.relays)
  const subid = crypto.randomBytes(40).toString('hex')

  pool
    .on('open', () => {
      relay.subscribe(subid, {limit: 10000, kinds: [10101]})
    })
    .on('event', () => {})

  setTimeout(() => {
    this.closePool(pool)
    resolve(true)
  }, 10 * 1000)
}

events.publish = async function () {}

export default Events
