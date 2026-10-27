import { ProbeTest, RelayConversation, probeEvents } from '../utils/RelayConversation.js'

export class EventValidation extends ProbeTest {
  readonly slug = 'EventValidation'
  readonly impact = 'low-write' as const
  readonly stress = 'normal' as const

  protected async scenario() {
    const relay = new RelayConversation(await this.openSession())
    const events = probeEvents([{}, {}, {}])
    await relay.establish([events[0]])
    const badHash = { ...events[1], content: `${events[1].content}:tampered` }
    const badSignature = {
      ...events[2],
      sig: `${events[2].sig[0] === '0' ? '1' : '0'}${events[2].sig.slice(1)}`,
    }
    for (const [name, event] of [['event hash', badHash], ['Schnorr signature', badSignature]] as const) {
      const result = await relay.publish(event)
      this.expect.behavior.toBeOk(!result.accepted, `relay rejects an invalid ${name}`)
      this.assertIds(await relay.query([{ ids: [event.id] }]), [], `invalid ${name} is not stored or served`)
    }
  }
}

export default EventValidation
