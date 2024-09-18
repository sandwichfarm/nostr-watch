import { Auditor } from '../dist/server/index.js';
import util from 'util';
import https from 'https';

const url = 'https://api.nostr.watch/v1/nip/50';

const results = []

try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const relays = await response.json();

  if (Array.isArray(relays)) {
    for (const relay of relays) {
      const auditor = new Auditor();
      auditor.removeSuite('Nip01');
      auditor.addSuite('Nip50') 
      const result = await auditor.test(relay);
      results.push(result);
    }
  } else {
    console.error('Unexpected response format. Expected an array.');
  }
} catch (error) {
  console.error('Fetch error:', error.message);
}


for( const result of results) {
  console.log(result.relay, result.suites.Nip50.pass);
}

let totalChecked = 0;
let totalPassed = 0;
let totalFailed = 0;

for (const result of results) {
  console.log(result.relay, result.suites.Nip50.pass);

  totalChecked++;
  if (result.suites.Nip50.pass) {
    totalPassed++;
  } else {
    totalFailed++;
  }
}

const percentagePassed = ((totalPassed / totalChecked) * 100).toFixed(2);

console.log('Total checked:', totalChecked);
console.log('Total passed:', totalPassed);
console.log('Total failed:', totalFailed);
console.log('Percentage passed:', percentagePassed + '%');