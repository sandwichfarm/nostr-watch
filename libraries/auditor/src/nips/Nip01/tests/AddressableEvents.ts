import { ProbeTest, RelayConversation, ProbeUnavailable, probeEvents } from '../utils/RelayConversation.js'

export class AddressableEvents extends ProbeTest {
  readonly slug = 'AddressableEvents'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const events = probeEvents([
      { kind: 30001, tags: [['d', 'one']] },
      { kind: 30001, tags: [['d', 'two']] },
      { kind: 30001, tags: [['d', 'one']] },
    ])
    for (const event of events) {
      const result = await relay.publish(event)
      if (!result.accepted) throw new ProbeUnavailable(`Addressable fixture publish rejected: ${result.message}`)
    }
    this.assertIds(await relay.query([{ authors: [events[0].pubkey], kinds: [30001] }]), events.slice(1),
      'addressable replacement keys include the d tag and preserve other addresses')
  }
}

export default AddressableEvents
