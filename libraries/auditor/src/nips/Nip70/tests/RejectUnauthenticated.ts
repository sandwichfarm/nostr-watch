import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import {generateTestKeypair, signTestEvent} from '#utils/signing.js'
import type {RelayOkMessage} from '#src/nips/Nip01/interfaces/index.js'

export class RejectUnauthenticated extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'RejectUnauthenticated'

  completeOn: CompleteOnTypeArray = ['off']

  private sentEventId: string | null = null
  private okReceived = false
  private okAccepted = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const {secretKey} = generateTestKeypair()
    const protectedEvent = signTestEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['-']],
        content: 'auditor-nip70-test'
      },
      secretKey
    )
    this.sentEventId = protectedEvent.id
    this.socket.send(JSON.stringify(['EVENT', protectedEvent]))
  }

  _onMessageOk(message: RelayOkMessage): boolean {
    if (message[1] !== this.sentEventId) return true
    this.okReceived = true
    this.okAccepted = message[2]
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    behavior.toBeOk(this.okReceived, 'relay responded to protected event from unauthenticated client')
    behavior.toBeOk(!this.okAccepted, 'relay rejected protected event (OK false) for unauthenticated client')
  }
}

export default RejectUnauthenticated
