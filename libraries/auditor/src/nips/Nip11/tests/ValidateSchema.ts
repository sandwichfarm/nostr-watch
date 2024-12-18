
import { ISuiteTest, SuiteTest } from '#base/SuiteTest.js';
import { ISuite } from '#base/Suite.js';

import { RelayEventMessage } from '#nips/Nip01/interfaces/index.js';
import type { INip11 } from '#nips/Nip11/interfaces/INip11.js';

export class ValidateSchema extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'ValidateSchema';
  contents: string[] = [];
  searches: string[] = [];

  constructor(suite: ISuite) {
    super(suite);
  }

  async prepare() {
    const relay = this.socket.relay.toString()
    const url = new URL(relay);
    url.protocol = 'https:';
    const controller = new AbortController();
    const { signal } = controller;
    const headers = { "Accept": "application/nostr+json" };
    const method = 'GET';
    let result = null;
    let data = [];
    await fetch(url.toString(), { method, headers, signal })
      .then(async (response) => {
        const nip11: INip11 = await response.json() as INip11;
        //console.log(nip11)
        this.suite.validateJson('NIP11', nip11);
        if(nip11?.supported_nips && this.isArrayOfNumbers(nip11.supported_nips)) {
          data = nip11.supported_nips.map((num: number) => {
            const str = String(num);
            return str.length === 1 ? `0${str}` : str;
          });
        }
      })
      .catch((e) => {
        //console.log('catch',  e.message)
        // this.resulter.set('reason', e.message)
        this.resulter.set('pass', false)
      });
    this.data = data
  }

  isArrayOfNumbers(arr: any): boolean {
    if(!Array.isArray(arr)) return false;
    for(let i = 0; i < arr.length; i++) {
      if(typeof arr[i] !== 'number') return false;
    }
    return true;
  }

  onMessageEvent(message: RelayEventMessage){
    const note = message[2];
    this.contents.push(note.content);
  }
}

export default ValidateSchema;