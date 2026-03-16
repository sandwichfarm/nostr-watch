import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'

export class RejectExpiredOnIngest extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'RejectExpiredOnIngest'

  completeOn: CompleteOnTypeArray = ['off']

  private sentEventId: string | null = null
  private okReceived = false
  private okAccepted = false
  private okMessage = ''

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const {secretKey} = generateTestKeypair()
    const pastExpiration = Math.floor(Date.now() / 1000) - 60
    const expiredEvent = signTestEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['expiration', String(pastExpiration)]],
        content: 'auditor-nip40-expired-test'
      },
      secretKey
    )
    this.sentEventId = expiredEvent.id
    this.socket.send(JSON.stringify(['EVENT', expiredEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (message[1] !== this.sentEventId) return true
    this.okReceived = true
    this.okAccepted = message[2]
    this.okMessage = message[3] ?? ''
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    behavior.toBeOk(this.okReceived, 'relay responded to expired event submission')
    behavior.toBeOk(!this.okAccepted, 'relay rejected event with past expiration tag (OK false)' + (this.okMessage ? ': ' + this.okMessage : ''))
  }
}

export default RejectExpiredOnIngest
