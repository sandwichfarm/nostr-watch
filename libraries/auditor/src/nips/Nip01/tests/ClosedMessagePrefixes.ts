import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import type {RelayClosedMessage} from '#src/nips/Nip01/interfaces/index.js'

const VALID_CLOSED_PREFIXES = [
  'auth-required:', 'restricted:', 'error:', 'rate-limited:',
  'blocked:', 'duplicate:', 'invalid:', 'pow:'
]

export class ClosedMessagePrefixes extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'ClosedMessagePrefixes'

  completeOn: CompleteOnTypeArray = ['off']

  private closedReceived = false
  private closedMessage = ''
  private eoseWithoutClosed = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    this.REQ([{limit: 1}])
  }

  _onMessageClosed(message: RelayClosedMessage): boolean {
    if (message[1] !== this.subId) return true
    this.closedReceived = true
    this.closedMessage = message[2] ?? ''
    this.test(this.expect)
    this.conclude()
    return false
  }

  _onMessageEose(): boolean {
    this.eoseWithoutClosed = true
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    if (this.eoseWithoutClosed) {
      behavior.skip = true
      return
    }
    behavior.toBeOk(this.closedReceived, 'relay sent CLOSED in response to REQ')
    behavior.toBeOk(
      VALID_CLOSED_PREFIXES.some(p => this.closedMessage.startsWith(p)),
      'relay used machine-readable prefix in CLOSED: ' + this.closedMessage
    )
  }
}

export default ClosedMessagePrefixes
