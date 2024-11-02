import assert from 'power-assert';
import Logger from './Logger.js';
import chalk from 'chalk';

export interface IExpectResult {
  message: string;
  pass: boolean;
  error?: Record<string, string | boolean>;
}

export class AssertWrap {
  private _result: IExpectResult[] = [];
  private _passed: string[] = [];
  private _failed: string[] = [];
  private logger = new Logger('@nostrwatch/auditor:AssertWrap', {
    showTimer: false,
    showNamespace: false
  });

  constructor(){
    this.logger.registerLogger('pass', 'info', chalk.green.bold)
    this.logger.registerLogger('fail', 'info', chalk.redBright.bold)
  }

  get result(): IExpectResult[] {
      return this._result;
  } 

  private set result(result: IExpectResult) {
      this._result.push(result);
  }

  get passed() {
      return this._passed;
  }

  get failed() {
      return this._failed;
  }

  get didPass() {
      return this._failed.length === 0;
  }

  get passRate() {
      return Math.round((this._passed.length / (this._passed.length + this._failed.length)) * 100);
  }

  private extractErrorDetails(error: any) {
    const { generatedMessage, code, actual, expected, operator } = error;
    return { generatedMessage, code, actual, expected, operator };
  }

  private createProxy(assertionFn: (...args: any[]) => void) {
    return new Proxy((...args: any[]) => assertionFn(...args), {
      apply: (target, thisArg, argumentsList) => {
        const message = argumentsList[argumentsList.length - 1];
        try {
          Reflect.apply(target, thisArg, argumentsList);
          const result: IExpectResult = { message, pass: true };
          this.result = result;
          this.logger.custom(`pass`, `${message}`, 3);
        } catch (error) {
          error = this.extractErrorDetails(error);
          const result: IExpectResult = { message, pass: false, error };
          this.result = result
          this.logger.custom(`fail`, `${message}`, 3);
        }
      },
    });
  }

  toBeOk = this.createProxy((value: any, message?: string) => assert.ok(value, message));
  toEqual = this.createProxy((actual: any, expected: any, message?: string) => assert.equal(actual, expected, message));
  toNotEqual = this.createProxy((actual: any, expected: any, message?: string) => assert.notEqual(actual, expected, message));
  toBe = this.createProxy((actual: any, expected: any, message?: string) => assert.strictEqual(actual, expected, message));
  toNotBe = this.createProxy((actual: any, expected: any, message?: string) => assert.notStrictEqual(actual, expected, message));
  toDeepEqual = this.createProxy((actual: any, expected: any, message?: string) => assert.deepEqual(actual, expected, message));
  toNotDeepEqual = this.createProxy((actual: any, expected: any, message?: string) => assert.notDeepEqual(actual, expected, message));
  toDeepStrictEqual = this.createProxy((actual: any, expected: any, message?: string) => assert.deepStrictEqual(actual, expected, message));
  toNotDeepStrictEqual = this.createProxy((actual: any, expected: any, message?: string) => assert.notDeepStrictEqual(actual, expected, message));
  toThrow = this.createProxy((block: () => void, error?: any, message?: string) => assert.throws(block, error, message));
  toNotThrow = this.createProxy((block: () => void, message?: string) => assert.doesNotThrow(block, message));
  toError = this.createProxy((error: any) => assert.ifError(error));
}

export class Expect { 
  message: AssertWrap = new AssertWrap()
  json: AssertWrap = new AssertWrap()
  behavior: AssertWrap = new AssertWrap()
  conditions: AssertWrap = new AssertWrap()
}