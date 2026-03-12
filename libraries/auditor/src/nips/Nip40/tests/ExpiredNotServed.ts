import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage, RelayEventMessage} from '#src/nips/Nip01/interfaces/index.js'
import type {TestKeypair} from '#utils/signing.js'

export class ExpiredNotServed extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'ExpiredNotServed'

  completeOn: CompleteOnTypeArray = ['off']

  private keypair: TestKeypair | null = null
  private publishedEventId: string | null = null
  private phase: 'publishing' | 'waiting' | 'querying' | 'done' = 'publishing'
  private publishOkAccepted = false
  private eventReturnedAfterExpiry = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    this.keypair = generateTestKeypair()
    const shortExpiration = Math.floor(Date.now() / 1000) + 5
    const testEvent = signTestEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['expiration', String(shortExpiration)]],
        content: 'auditor-nip40-expiry-test'
      },
      this.keypair.secretKey
    )
    this.publishedEventId = testEvent.id
    this.phase = 'publishing'
    this.socket.send(JSON.stringify(['EVENT', testEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (this.phase !== 'publishing') return true
    if (message[1] !== this.publishedEventId) return true
    this.publishOkAccepted = message[2]
    if (!message[2]) {
      this.expect.behavior.skip = true
      this.test(this.expect)
      this.conclude()
      return false
    }
    this.phase = 'waiting'
    setTimeout(() => {
      this.phase = 'querying'
      this.REQ([{ids: [this.publishedEventId!]}])
    }, 6000)
    return false
  }

  _onMessageEvent(message: RelayEventMessage): boolean {
    if (this.phase === 'querying') {
      this.eventReturnedAfterExpiry = true
    }
    return true
  }

  _onMessageEose(): boolean {
    if (this.phase === 'querying') {
      this.phase = 'done'
      this.test(this.expect)
      this.conclude()
      return false
    }
    return true
  }

  test({behavior}) {
    if (!this.publishOkAccepted) {
      behavior.skip = true
      return
    }
    if (this.eventReturnedAfterExpiry) {
      behavior.toBeOk(true, 'advisory: relay still serves event after expiration (NIP-40 SHOULD NOT, not MUST NOT)')
    } else {
      behavior.toBeOk(true, 'relay stopped serving event after expiration tag timestamp passed')
    }
  }
}

export default ExpiredNotServed
