import { ProbeTest, RelayConversation, probeEvents } from '../utils/RelayConversation.js'

export class FilterInclusiveRange extends ProbeTest {
  readonly slug = 'FilterInclusiveRange'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const timestamp = Math.floor(Date.now() / 1000) - 30
    const events = probeEvents([-1, 0, 1].map(offset => ({ created_at: timestamp + offset })))
    await relay.establish(events)
    const ids = events.map(event => event.id)
    this.assertIds(await relay.query([{ ids, since: timestamp, until: timestamp }]), [events[1]],
      'equal since and until include events exactly at that timestamp')
    this.assertIds(await relay.query([{ ids, since: timestamp }]), events.slice(1),
      'since is inclusive')
    this.assertIds(await relay.query([{ ids, until: timestamp }]), events.slice(0, 2),
      'until is inclusive')
  }
}

export default FilterInclusiveRange
