
import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { INip01Filter } from '../interfaces/index.js';

export class FilterLimit extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterLimit';
  totalEvents: number = 0;
  maxEvents: number = 10;

  limit: number = 1

  constructor(suite: ISuite) {
    super(suite);
  }

  get filters(): INip01Filter[] {
    return [{ limit: this.limit }]
  }

  test({behavior}){
    behavior.toEqual(this.totalEvents, this.limit, 'returned correct number of events');
    behavior.toBeOk(this.totalEvents > 0, 'returned at least one event');
    behavior.toBeOk(!(this.totalEvents > this.limit), 'did not return too many events');
  }
}

export default FilterLimit;