import { ProbeTest, RelayConversation, probeEvents } from '../utils/RelayConversation.js'

export class FilterIds extends ProbeTest {
  readonly slug = 'FilterIds'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const events = probeEvents([{}, {}, {}])
    await relay.establish(events)
    this.assertIds(await relay.query([{ ids: [events[0].id, events[2].id] }]), [events[0], events[2]],
      'ids use exact matching and OR between requested IDs')
  }
}

export default FilterIds
