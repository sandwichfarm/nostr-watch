
import { CompleteOnTypeArray, ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { Nip01ClientMessageGenerator } from '#nips/Nip01/index.js';
import { INip01Filter, Note, RelayEventMessage } from '#nips/Nip01/interfaces/index.js';
import { ContentIngestor } from '../ingestors/ContentIngestor.js';

export interface Nip50Filter extends INip01Filter {
  search: string;
}

export class Search extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'Search';
  contents: string[] = [];
  searches: string[] = [];
  completeOn: CompleteOnTypeArray = ['off'];
  
  constructor(suite: ISuite) {
    super(suite);
    this.registerIngestor(new ContentIngestor());
  }

  get filters(): Nip50Filter[] {
    const filters: Nip50Filter[] = [];
    this.searches = this.ingestor.poop()
    if(this.searches.length > 5){
      this.searches.length = 5;
    }
    for(const search of this.searches){
      filters.push({ search, limit:1 });
    }
    return filters
  }

  onMessageEvent(message: RelayEventMessage){
    if(this.totalEvents >= this.searches.length) {
      if(this.socket.CONNECTED)
        return this.socket.terminate();
    } 
    const note = message[2];
    this.contents.push(note.content);
  }

  test({behavior, conditions}) {
    conditions.toBeOk(this.searches.length > 0, 'data sample size is sufficient for test');

    const eventsContainedTerms = this.contents.some(content => {
      return this.searches.some(term => {
        const regex = new RegExp(term, 'i'); 
        return regex.test(content);
      });
    });
    
    behavior.toEqual(this.contents.length, this.searches.length, 'returned same number of events as searches');
    behavior.toBeOk(eventsContainedTerms, 'returned events contain search terms');
  }
}

export default Search;