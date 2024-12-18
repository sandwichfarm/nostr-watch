
import { CompleteOnTypeArray, ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { INip01Filter, Note, RelayEventMessage } from '#nips/Nip01/interfaces/index.js';
import { ContentIngestor } from '../ingestors/ContentIngestor.js';
import { AssertWrap } from '#src/base/Expect.js';

export interface Nip50Filter extends INip01Filter {
  search: string;
}

export class Search extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'Search';
  contentsRecievedWithTerms: string[] = [];
  searchTermsToFilter: string[] = [];
  completeOn: CompleteOnTypeArray = ['off'];
  
  constructor(suite: ISuite) {
    super(suite);
    this.suiteIngest(new ContentIngestor(5));
  }

  get filters(): Nip50Filter[] {
    const filters: Nip50Filter[] = [];
    if(this.searchTermsToFilter.length > 1){
      this.searchTermsToFilter.length = 1;
    }
    const search = this.searchTermsToFilter[0]
    return [{ search, limit:1 }]
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    this.contentsRecievedWithTerms.push(note.content);
  }

  digest(){
    this.searchTermsToFilter = this.getSamples<string[]>();
  }

  precheck(conditions: AssertWrap): void {
    conditions.toBeOk(this.searchTermsToFilter.length > 0, 'data sample size is sufficient for test');
  }

  test({behavior, conditions}) {
    const eventsContainedTerms = this.contentsRecievedWithTerms.every(content => {
      return this.searchTermsToFilter.some(term => {
        const regex = new RegExp(term, 'i'); 
        return regex.test(content);
      });
    });
    
    behavior.toEqual(this.contentsRecievedWithTerms.length, this.searchTermsToFilter.length, 'returned same number of events as searchTermsToFilter');
    behavior.toBeOk(eventsContainedTerms, 'returned events contain search terms');
  }
}

export default Search;