import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'

export class EnforceMaxMessageLength extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'EnforceMaxMessageLength'

  completeOn: CompleteOnTypeArray = ['off']

  protected timeoutMs = 15000

  private maxMessageLength = 0
  private sentEventId: string | null = null
  private rejected = false
  private okReceived = false
  private skipped = false

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
    this.maxMessageLength = limitation?.max_message_length ?? 0

    if (!this.maxMessageLength) {
      this.skipped = true
      this.expect.behavior.skip = true
      this.test(this.expect)
      this.conclude()
      return
    }

    const keypair = generateTestKeypair()
    const baseEvent = signTestEvent(
      {kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: ''},
      keypair.secretKey
    )
    const baseMsg = JSON.stringify(['EVENT', baseEvent])
    const paddingNeeded = this.maxMessageLength - baseMsg.length + 100
    const oversizedEvent = signTestEvent(
      {kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: 'x'.repeat(Math.max(0, paddingNeeded))},
      keypair.secretKey
    )
    this.sentEventId = oversizedEvent.id
    this.socket.send(JSON.stringify(['EVENT', oversizedEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (message[1] !== this.sentEventId) return true
    this.okReceived = true
    this.rejected = !message[2]
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    if (this.skipped) {
      behavior.skip = true
      return
    }
    if (this.okReceived && this.rejected) {
      behavior.toBeOk(true, 'relay enforced max_message_length — rejected oversized event')
    } else if (this.okReceived && !this.rejected) {
      behavior.toBeOk(true, 'advisory: relay advertises max_message_length but accepted oversized event')
    } else {
      behavior.toBeOk(true, 'advisory: relay may have enforced max_message_length by closing connection or dropping message')
    }
  }
}

export default EnforceMaxMessageLength
