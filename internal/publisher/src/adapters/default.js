import { SimplePool } from "nostr-tools"

export default class {

  constructor(relays){
    this.relays = relays
    this.pool = new SimplePool()
  }

  async publish(signedEvent) {
    // pool.publish returns an ARRAY of promises, one per relay
    const promises = this.pool.publish(this.relays, signedEvent)

    // Use Promise.allSettled to handle each relay promise independently
    // This prevents unhandled rejections when individual relays fail
    const results = await Promise.allSettled(promises)

    // Return summary of successes/failures
    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value)
    const failed = results.filter(r => r.status === 'rejected').map(r => r.reason)

    if(failed.length > 0) {
      // Log failures but don't crash
      failed.forEach((err, idx) => {
        console.warn(`Publisher: relay ${this.relays[results.findIndex((r, i) => results[i].status === 'rejected' && results.slice(0, i+1).filter(x => x.status === 'rejected').length === failed.indexOf(err)+1)]} failed: ${err?.message || err}`)
      })
    }

    return { successful, failed, total: this.relays.length }
  }
}