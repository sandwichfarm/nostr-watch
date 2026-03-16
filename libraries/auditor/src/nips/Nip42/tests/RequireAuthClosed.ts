import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import type {RelayClosedMessage} from '#src/nips/Nip01/interfaces/index.js'

export class RequireAuthClosed extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'RequireAuthClosed'

  completeOn: CompleteOnTypeArray = ['off']

  private closedReceived = false
  private closedMessage = ''
  private closedHasAuthPrefix = false

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
    this.closedHasAuthPrefix = this.closedMessage.startsWith('auth-required:')
    this.test(this.expect)
    this.conclude()
    return false
  }

  _onMessageEose(): boolean {
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    behavior.toBeOk(this.closedReceived, 'relay sent CLOSED to unauthenticated REQ')
    behavior.toBeOk(
      this.closedHasAuthPrefix,
      'CLOSED message uses auth-required: prefix' + (this.closedMessage ? ': ' + this.closedMessage : '')
    )
  }
}

export default RequireAuthClosed
