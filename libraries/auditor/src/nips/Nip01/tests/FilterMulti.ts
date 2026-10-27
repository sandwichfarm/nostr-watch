
import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { INip01Filter } from '../interfaces/index.js';
import { RangeIngestor } from '../ingestors/RangeIngestor.js';
import type { AssertWrap } from '#base/Expect.js';

export class FilterMulti extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterMulti';
  
  limit: number = 1
  private timestamps: number[] = [];

  constructor(suite: ISuite) {
    super(suite);
    this.suiteIngest(new RangeIngestor(4));
  }

  digest() {
    const sampled = [...new Set(this.getSamples<number[]>() ?? [])].sort((a, b) => a - b);
    this.timestamps = sampled.length > 1 ? [sampled[0], sampled[sampled.length - 1]] : [];
  }

  precheck(conditions: AssertWrap) {
    conditions.toBeOk(this.timestamps.length === 2, 'two distinct sampled timestamps are available');
  }

  get filters(): INip01Filter[] {
    return this.timestamps.map(timestamp => ({ since: timestamp, until: timestamp, limit: this.limit }));
  }

  test({behavior}){
    behavior.toBeOk(this.totalEvents > 0, 'returned at least one event');
    behavior.toBeOk(this.totalEvents <= this.filters.length * this.limit, 'respected the combined filter limits');
    behavior.toBeOk(this.events.every(event => this.timestamps.includes(event.created_at)), 'returned events matching either filter');
  }
}

export default FilterMulti;
