/// <reference lib="deno.ns" />

import {
  extractRttTimeSeries,
  transformUptimeHistory,
} from '../src/utils/transforms.ts';

Deno.test('relay chart transforms preserve uptime periods', () => {
  const periods = transformUptimeHistory([
    { start: 100, end: 200, online: true, rtt: 42 },
    { start: 200, end: null, online: false },
  ]);

  if (periods.length !== 2) {
    throw new Error(`expected two periods, got ${periods.length}`);
  }

  if (periods[0].rtt !== 42 || periods[1].online !== false) {
    throw new Error('uptime period data was not preserved');
  }
});

Deno.test('relay chart transforms extract online RTT samples', () => {
  const samples = extractRttTimeSeries([
    { start: 100, end: 200, online: true, rtt: 42 },
    { start: 200, end: 300, online: true },
    { start: 300, end: 400, online: false, rtt: 100 },
  ]);

  if (samples.length !== 1) {
    throw new Error(`expected one RTT sample, got ${samples.length}`);
  }

  const sample = samples[0];
  if (sample.timestamp !== 100 || sample.value !== 42 || sample.label !== 'RTT (ms)') {
    throw new Error('RTT sample was not extracted correctly');
  }
});
