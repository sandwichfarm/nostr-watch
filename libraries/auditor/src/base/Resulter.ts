import { type ISuiteTestResult } from "./SuiteTest.js";
import { type ISuiteResult } from "./Suite.js";
import { type IResult } from "./Auditor.js";

type NestedKey<T> = T extends Record<string, any> ? keyof T : never;

class BaseResulter<T extends Record<string, any>> {
  private _result: T;

  constructor(initialResult: T) {
    this._result = initialResult;
  }

  set(value: T): void;
  set<K extends keyof T>(key: K, value: T[K]): void;
  set<K extends keyof T, K2 extends NestedKey<T[K]>>(key1: K, key2: K2, value: T[K][K2]): void;

  set(keyOrValue: keyof T | T, key2OrValue?: any, value?: any): void {
    if (arguments.length === 1) {
      this._result = keyOrValue as T;
    } else if (arguments.length === 2) {
      this._result[keyOrValue as keyof T] = key2OrValue;
    } else if (arguments.length === 3) {
      (this._result[keyOrValue as keyof T] as Record<string, any>)[key2OrValue] = value;
    }
  }

  get(key?: keyof T): T {
    if (key) {
      return this._result[key];
    } else {
      return this._result;
    }
  }

  set result(value: T) {
    this._result = value;
  }

  get result() {
    return this._result;
  }
}

export class Resulter extends BaseResulter<IResult> {
  constructor(defaultResult: IResult) {
    super(structuredClone(defaultResult));
  }
}

export class SuiteResulter extends BaseResulter<ISuiteResult> {
  constructor(defaultSuiteResult: ISuiteResult) {
    super(structuredClone(defaultSuiteResult));
  }
}

export class SuiteTestResulter extends BaseResulter<ISuiteTestResult> {
  constructor(defaultSuiteTestResult: ISuiteTestResult) {
    super(structuredClone(defaultSuiteTestResult));
  }
}
