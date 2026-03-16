import type {ISuite} from '#base/Suite.js'
import {SuiteTest, type CompleteOnTypeArray, type ISuiteTest} from '#base/SuiteTest.js'

export class DetectChallenge extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'DetectChallenge'

  completeOn: CompleteOnTypeArray = ['off']
  protected timeoutMs: number = 5000

  constructor(suite: ISuite) {
    super(suite)
  }

  async prepare() {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const challenge = this.suite.state.get<string>('challenge')
      if (challenge) break
      await new Promise(r => setTimeout(r, 100))
    }
    this.test(this.expect)
    this.conclude()
  }

  test({behavior}) {
    behavior.toBeOk(
      this.suite.state.get('challenge') !== undefined,
      'relay sent AUTH challenge on connect'
    )
  }
}

export default DetectChallenge
