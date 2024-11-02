# auditor

A framework to test relays against their advertised supported NIPs.

# usage

```js

import Auditor from "@nostrwatch/auditor"

const relay = "wss://relay.damus.io"
const audit = new Auditor(options)
audit.addSuite('Nip50') 
audit.removeSuite('Nip01') //Nip01 runs by default.
const results = audit.test(relay)
```

Writing a suite

TODO.

Write a suite's test

```js
//this is i
import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { Nip01Filter } from '../interfaces/index.js';

export class FilterLimit extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterLimit';
  totalEvents: number = 0;
  maxEvents: number = 10;

  constructor(suite: ISuite) {
    super(suite);
  }

  get filters(): Nip01Filter[] {
    return [{ limit: this.limit }];
  }

  test(){
    this.expect.toEqual(this.totalEvents, this.limit, 'returned correct number of events');
    this.expect.toBeOk(this.totalEvents > 0, 'returned at least one event');
    this.expect.toBeOk(!(this.totalEvents > this.limit), 'did not return too many events');
  }
}

export default FilterLimit;
```