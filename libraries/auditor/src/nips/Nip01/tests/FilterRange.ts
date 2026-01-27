
import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';
;
import { INip01Filter, RelayEventMessage } from '../interfaces/index.js';
import { RangeIngestor } from "../ingestors/RangeIngestor.js";
import { AssertWrap } from '#src/base/Expect.js';

export class FilterRange extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterRange';

  maxEvents: number = 15;
  timestampsReturned: number[] = [];
  range: { since: number, until: number } | null = null;
  limit: number = 10;

  constructor(suite: ISuite) {
    super(suite);
    this.suiteIngest(new RangeIngestor(30));
  }

  digest(){
    this.range = this.selectRangeFromSample(this.getSamples<number[]>());
  }

  get filters(): INip01Filter[] {
    return [{ ...this.range, limit: this.limit }];
  }
  
  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    this.timestampsReturned.push(note.created_at);
  }

  precheck(conditions: AssertWrap){
    const bothRangeValuesAreNumbers = typeof this?.range?.since === 'number' && typeof this?.range?.until === 'number';
    const rangeValuesAreDifferent = this?.range?.since != this?.range?.until;
    const untilIsGreaterThanSince = this?.range?.until > this?.range?.since;
    const sampleSufficient = bothRangeValuesAreNumbers && rangeValuesAreDifferent && untilIsGreaterThanSince;
    conditions.toBeOk(untilIsGreaterThanSince, 'until is greater than since');
    conditions.toBeOk(bothRangeValuesAreNumbers, 'since and until are numbers');
    conditions.toNotEqual(this?.range?.since, this?.range?.until, 'since and until are different values');
    conditions.toBeOk(sampleSufficient, 'sample data to be sufficient')
    
  }


  test({behavior}){
    behavior.toEqual(this.timestampsReturned.length, this.limit, `returned number of events requested`);
    behavior.toBeOk(this.timestampsReturned.length > 0, 'returned at least one event');
    behavior.toBeOk(() => this.withinRange(), 'return only events within range')
  }

  private withinRange(): boolean {
    return this.timestampsReturned
        .every(timestamp => {
            return timestamp >= this.range.since
                   && timestamp <= this.range.until;
        });
  }

  private selectRangeFromSample(timestamps: number[]): { since: number, until: number } | null {
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    if (sortedTimestamps.length < 4) return null;
    //TODO: Determine how to handle ambiguity.
    const since = sortedTimestamps[1];
    const until = sortedTimestamps[sortedTimestamps.length - 2]; 
    return { since, until };
  }
}

export default FilterRange;