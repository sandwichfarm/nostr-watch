import { ProbeTest, RelayConversation, probeEvents } from '../utils/RelayConversation.js'
import type { INip01Filter } from '../interfaces/index.js'

export class FilterEmptyLists extends ProbeTest {
  readonly slug = 'FilterEmptyLists'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const [event] = probeEvents([{ tags: [['x', 'nonempty']] }])
    await relay.establish([event])
    const filters: INip01Filter[] = [
      { authors: [event.pubkey], ids: [] },
      { ids: [event.id], authors: [] },
      { ids: [event.id], kinds: [] },
      { ids: [event.id], '#x': [] },
    ]
    for (const filter of filters) {
      this.assertIds(await relay.query([filter]), [], `empty ${Object.keys(filter)[1]} list matches no events`)
    }
  }
}

export default FilterEmptyLists
