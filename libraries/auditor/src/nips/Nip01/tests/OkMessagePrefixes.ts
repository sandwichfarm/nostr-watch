import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'

const VALID_OK_FAILURE_PREFIXES = [
  'duplicate:', 'pow:', 'blocked:', 'rate-limited:', 'invalid:', 'error:',
  'auth-required:', 'restricted:', 'mute:'
]

export class OkMessagePrefixes extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'OkMessagePrefixes'

  completeOn: CompleteOnTypeArray = ['off']

  private phase: 'awaiting-first-ok' | 'awaiting-duplicate-ok' | 'done' = 'awaiting-first-ok'
  private sentEventId: string | null = null
  private signedEvent: any = null
  private duplicateOkReceived = false
  private duplicateOkAccepted = true
  private duplicateOkMessage = ''
  private firstOkAccepted = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const {secretKey} = generateTestKeypair()
    const event = signTestEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'auditor-nip01-prefix-test'
      },
      secretKey
    )
    this.sentEventId = event.id
    this.signedEvent = event
    this.socket.send(JSON.stringify(['EVENT', event]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (message[1] !== this.sentEventId) return true

    if (this.phase === 'awaiting-first-ok') {
      this.firstOkAccepted = message[2]
      if (!message[2]) {
        // Relay rejected first event — use this OK false to test prefix
        this.duplicateOkReceived = true
        this.duplicateOkAccepted = message[2]
        this.duplicateOkMessage = message[3] ?? ''
        this.phase = 'done'
        this.test(this.expect)
        this.conclude()
        return false
      }
      // First publish accepted — re-send to trigger duplicate rejection
      this.phase = 'awaiting-duplicate-ok'
      this.socket.send(JSON.stringify(['EVENT', this.signedEvent]))
      return false
    }

    if (this.phase === 'awaiting-duplicate-ok') {
      this.duplicateOkReceived = true
      this.duplicateOkAccepted = message[2]
      this.duplicateOkMessage = message[3] ?? ''
      this.phase = 'done'
      if (message[2] === true) {
        // Relay accepted duplicate silently — MSG-01 not testable via this path
        this.expect.behavior.skip = true
      }
      this.test(this.expect)
      this.conclude()
      return false
    }

    return true
  }

  test({behavior}) {
    if (this.expect.behavior.skip) return
    behavior.toBeOk(this.duplicateOkReceived, 'relay responded to duplicate/rejected event submission')
    behavior.toBeOk(!this.duplicateOkAccepted, 'relay returned OK false for rejected event')
    behavior.toBeOk(
      VALID_OK_FAILURE_PREFIXES.some(p => this.duplicateOkMessage.startsWith(p)),
      'relay used machine-readable prefix in OK failure: ' + this.duplicateOkMessage
    )
  }
}

export default OkMessagePrefixes
