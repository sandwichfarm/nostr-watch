import { ProbeTest, RelayConversation, probeEvents } from '../utils/RelayConversation.js'

export class FilterLimitOrder extends ProbeTest {
  readonly slug = 'FilterLimitOrder'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const now = Math.floor(Date.now() / 1000) - 30
    const events = probeEvents([0, 1, 1, 2].map(offset => ({ created_at: now + offset })))
    await relay.establish(events)
    const expected = [...events].sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
    const actual = await relay.query([{ ids: events.map(event => event.id), limit: 3 }])
    this.expect.behavior.toBeOk(actual.length > 0 && actual.length <= 3,
      'initial limit returns a nonempty bounded subset of observed fixtures')
    this.expect.behavior.toDeepEqual(actual.map(event => event.id), expected.slice(0, actual.length).map(event => event.id),
      'limited stored events are newest first with lowest ID first for tied timestamps')
  }
}

export default FilterLimitOrder
