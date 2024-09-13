import { SimplePool } from "nostr-tools"

export default class {
  constructor(relays){
    this.relays = relays
    this.pool = new SimplePool()
  }

  async publish(signedEvent) {
    return this.pool.publish(this.relays, signedEvent)
  }
}