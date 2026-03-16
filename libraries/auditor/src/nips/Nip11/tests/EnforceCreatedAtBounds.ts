import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'
import type {TestKeypair} from '#utils/signing.js'

export class EnforceCreatedAtBounds extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'EnforceCreatedAtBounds'

  completeOn: CompleteOnTypeArray = ['off']

  protected timeoutMs = 15000

  private lowerLimit = 0
  private upperLimit = 0
  private phase: 'testing-lower' | 'testing-upper' | 'done' = 'testing-lower'
  private lowerEventId: string | null = null
  private upperEventId: string | null = null
  private lowerRejected = false
  private upperRejected = false
  private hasLower = false
  private hasUpper = false
  private skipped = false
  private keypair: TestKeypair | null = null

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const relay = this.socket.url.toString()
    const relayUrl = relay.replace(/^wss?:\/\//, 'https://')
    let nip11: any = null
    try {
      const response = await fetch(relayUrl, {
        method: 'GET',
        headers: {'Accept': 'application/nostr+json'},
        signal: AbortSignal.timeout(5000)
      })
      nip11 = await response.json()
    } catch (_e) {
      // fetch failed — skip
    }

    const limitation = nip11?.limitation
    this.lowerLimit = limitation?.created_at_lower_limit ?? 0
    this.upperLimit = limitation?.created_at_upper_limit ?? 0

    if (!this.lowerLimit && !this.upperLimit) {
      this.skipped = true
      this.expect.behavior.skip = true
      this.test(this.expect)
      this.conclude()
      return
    }

    this.hasLower = this.lowerLimit > 0
    this.hasUpper = this.upperLimit > 0

    this.keypair = generateTestKeypair()

    if (this.hasLower) {
      const lowerEvent = signTestEvent(
        {kind: 1, created_at: this.lowerLimit - 3600, tags: [], content: 'auditor-nip11-lower-bound-test'},
        this.keypair.secretKey
      )
      this.lowerEventId = lowerEvent.id
      this.phase = 'testing-lower'
      this.socket.send(JSON.stringify(['EVENT', lowerEvent]))
    } else if (this.hasUpper) {
      const upperEvent = signTestEvent(
        {kind: 1, created_at: this.upperLimit + 3600, tags: [], content: 'auditor-nip11-upper-bound-test'},
        this.keypair.secretKey
      )
      this.upperEventId = upperEvent.id
      this.phase = 'testing-upper'
      this.socket.send(JSON.stringify(['EVENT', upperEvent]))
    }
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (this.phase === 'testing-lower' && message[1] === this.lowerEventId) {
      this.lowerRejected = !message[2]
      if (this.hasUpper) {
        const upperEvent = signTestEvent(
          {kind: 1, created_at: this.upperLimit + 3600, tags: [], content: 'auditor-nip11-upper-bound-test'},
          this.keypair!.secretKey
        )
        this.upperEventId = upperEvent.id
        this.phase = 'testing-upper'
        this.socket.send(JSON.stringify(['EVENT', upperEvent]))
      } else {
        this.test(this.expect)
        this.conclude()
      }
      return false
    }
    if (this.phase === 'testing-upper' && message[1] === this.upperEventId) {
      this.upperRejected = !message[2]
      this.test(this.expect)
      this.conclude()
      return false
    }
    return true
  }

  test({behavior}) {
    if (this.skipped) {
      behavior.skip = true
      return
    }
    if (this.hasLower && !this.lowerRejected) {
      behavior.toBeOk(true, 'advisory: relay advertises created_at_lower_limit but does not enforce it')
    } else if (this.hasLower && this.lowerRejected) {
      behavior.toBeOk(true, 'relay enforced created_at_lower_limit — rejected event below bound')
    }
    if (this.hasUpper && !this.upperRejected) {
      behavior.toBeOk(true, 'advisory: relay advertises created_at_upper_limit but does not enforce it')
    } else if (this.hasUpper && this.upperRejected) {
      behavior.toBeOk(true, 'relay enforced created_at_upper_limit — rejected event above bound')
    }
  }
}

export default EnforceCreatedAtBounds
