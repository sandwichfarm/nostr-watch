import { ProbeTest, RelayConversation, probeEvents } from '../utils/RelayConversation.js'

export class FilterSemantics extends ProbeTest {
  readonly slug = 'FilterSemantics'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const events = probeEvents([
      { tags: [['x', 'red'], ['y', 'round']] },
      { tags: [['x', 'blue'], ['y', 'square']] },
      { tags: [['x', 'green'], ['y', 'round'], ['X', 'UPPER', 'not-indexed']] },
    ])
    await relay.establish(events)
    const ids = events.map(event => event.id)
    this.assertIds(await relay.query([{ ids, '#x': ['red', 'blue'] }]), events.slice(0, 2),
      'multiple values in a tag filter are OR conditions')
    this.assertIds(await relay.query([{ ids, '#x': ['red', 'blue'], '#y': ['round'] }]), [events[0]],
      'conditions within a filter are AND conditions')
    this.assertIds(await relay.query([{ ids: [events[0].id] }, { ids: [events[2].id] }]), [events[0], events[2]],
      'separate filters are OR conditions')
    this.assertIds(await relay.query([{ ids, '#X': ['UPPER'] }]), [events[2]],
      'uppercase single-letter tag names are indexed independently')
    this.assertIds(await relay.query([{ ids, '#x': ['UPPER'] }]), [],
      'uppercase and lowercase tag names remain distinct')
    this.assertIds(await relay.query([{ ids, '#X': ['not-indexed'] }]), [],
      'only the first value of a tag is indexed')
    this.assertIds(await relay.query([{ ids: [events[0].id], kinds: [2] }]), [],
      'ids do not override a nonmatching kind condition')
  }
}

export default FilterSemantics
