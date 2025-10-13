import { SimplePool } from "nostr-tools"

export default class {

  constructor(relays){
    this.relays = relays
    this.pool = new SimplePool()
  }

  async publish(signedEvent) {
    try {
      // pool.publish returns a Promise that resolves to relay responses
      const result = await this.pool.publish(this.relays, signedEvent)
      return result
    } catch(e) {
      // Catch any errors from the publish operation (like certificate errors)
      console.warn(`Publisher adapter: publish error: ${e?.message || e}`)
      return null
    }
  }
}