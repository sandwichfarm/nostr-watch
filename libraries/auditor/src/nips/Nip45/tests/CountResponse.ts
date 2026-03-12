import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'
import type {RelayClosedMessage} from '#src/nips/Nip01/interfaces/index.js'
import type {RelayCountMessage} from '../interfaces/index.js'

export class CountResponse extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'CountResponse'

  completeOn: CompleteOnTypeArray = ['off']

  private responseReceived = false
  private countIsValid = false
  private refusedWithClosed = false

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    this.socket.send(JSON.stringify(['COUNT', this.subId, {limit: 1}]))
  }

  _onMessageCount(message: RelayCountMessage): boolean {
    if (message[1] !== this.subId) return true
    this.responseReceived = true
    this.countIsValid = typeof message[2]?.count === 'number'
    this.test(this.expect)
    this.conclude()
    return false
  }

  _onMessageClosed(message: RelayClosedMessage): boolean {
    if (message[1] !== this.subId) return true
    this.responseReceived = true
    this.refusedWithClosed = true
    this.test(this.expect)
    this.conclude()
    return false
  }

  test({behavior}) {
    behavior.toBeOk(this.responseReceived, 'relay responded to COUNT request (COUNT response or CLOSED refusal)')
    if (this.refusedWithClosed) {
      behavior.toBeOk(true, 'relay refused COUNT with CLOSED — valid per NIP-45 spec')
    } else {
      behavior.toBeOk(this.countIsValid, 'COUNT response contains valid numeric count field')
    }
  }
}

export default CountResponse
