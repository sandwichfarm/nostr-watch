
import { CompleteOnTypeArray, ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { Nip01ClientMessageGenerator } from '../index.js';
import { INip01Filter, Note, RelayEventMessage } from '../interfaces/index.js';

export class FilterMulti extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterMulti';
  
  limit: number = 1

  constructor(suite: ISuite, ) {
    super(suite);
  }

  get filters(): INip01Filter[] {
    return [
      { until: Math.round(Date.now()/1000)-120, limit: this.limit },
      { until: Math.round(Date.now()/1000)-60, limit: this.limit }
    ];
  }

  test({behavior}){
    behavior.toBeOk(this.totalEvents > 0, 'returned at least one event');
    behavior.toEqual(this.totalEvents, this.filters.length, 'returned correct number of events');
  }
}

export default FilterMulti;