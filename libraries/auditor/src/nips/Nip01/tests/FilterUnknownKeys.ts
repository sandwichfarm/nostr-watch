import { ProbeTest, RelayConversation, SubscriptionRejected, probeEvents } from '../utils/RelayConversation.js'
import type { INip01Filter } from '../interfaces/index.js'

export class FilterUnknownKeys extends ProbeTest {
  readonly slug = 'FilterUnknownKeys'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const events = probeEvents([{}, {}])
    await relay.establish(events)
    try {
      for (const value of [null, true, 123, 'ignored', ['ignored'], { ignored: true }]) {
        const filter = { ids: events.map(event => event.id), __auditor_unknown: value } as INip01Filter
        this.assertIds(await relay.query([filter]), events, 'ignored unknown filter keys preserve recognized filter semantics')
      }
    } catch (error) {
      // NIP-01 explicitly allows CLOSED for unsupported filter elements.
      if (!(error instanceof SubscriptionRejected)) throw error
      this.skip(`Unknown-key interoperability unavailable: ${error.reason}`)
    }
  }
}

export default FilterUnknownKeys
