import { SimplePool } from "nostr-tools"

export default class {

  constructor(relays){
    this.relays = relays
    this.pool = new SimplePool()
  }

  async publish(signedEvent) {
    try {
      const result = await this.pool.publish(this.relays, signedEvent).catch(e => {
        // Catch any errors from individual relay connections (like certificate errors)
        console.warn(`Publisher adapter: relay connection error: ${e?.message || e}`)
        return null
      })
      return result
    } catch(e) {
      console.warn(`Publisher adapter: publish error: ${e?.message || e}`)
      return null
    }
  }
}