import { Nocap } from 'npm:@nostrwatch/nocap';
import WebsocketAdapterDefault from '@nostrwatch/nocap-websocket-adapter-default';
import InfoAdapterDefault from '@nostrwatch/nocap-info-adapter-default';
import DnsAdapterDefault from '@nostrwatch/nocap-dns-adapter-default';
import { Kind30166 } from 'npm:@nostrwatch/publisher';
import { getPublicKey, verifyEvent } from 'npm:nostr-tools';
import { isRelayCheckResult } from '../../../src/types/relay.ts';
import { parseRelayNetwork } from 'npm:@nostrwatch/utils';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

if (Deno.args[0] === 'ingress') {
  let reachable = false;
  // The relay may initiate the test connection, but the monitor firewall must
  // drop it even though the monitor has a wildcard-bound sentinel listener.
  const connection = Deno.connect({ hostname: 'monitor.fips', port: 7778 });
  await Promise.race([
    connection.then((socket) => { reachable = true; socket.close(); }).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  assert(!reachable, 'Monitor sentinel exposed to FIPS');
  console.log('FIPS_INGRESS_PROOF ' + JSON.stringify({ monitorSentinelReachable: false }));
  Deno.exit(0);
}

const npub = Deno.env.get('FIPS_RELAY_NPUB');
assert(npub, 'Missing fixture relay identity');
const url = `ws://${npub}.fips:7777`;
assert(parseRelayNetwork(url) === 'fips', 'Seeder classifier lost FIPS');
const nocap = new Nocap(url, { timeout: 8000, logLevel: 'error' });
await nocap.useAdapters([WebsocketAdapterDefault, InfoAdapterDefault, DnsAdapterDefault]);
const result = await nocap.check(['open', 'read', 'write', 'info', 'dns']);
for (const check of ['open', 'read', 'write']) assert(result[check]?.data === true, `${check} failed: ${JSON.stringify(result[check])}`);
assert(result.info?.data?.name === 'Isolated FIPS relay fixture', 'NIP-11 fetch failed');
assert(result.dns?.status === 'error', 'Overlay DNS did not skip public resolution');
assert(result.network === 'fips', 'NOCAP classifier lost FIPS');
assert(isRelayCheckResult({ ...result, checked_at: 1_700_000_000, online: true, ignore: false, parent: '' }), 'Relaymon rejects FIPS result');
const secret = crypto.getRandomValues(new Uint8Array(32));
const builder = new Kind30166(getPublicKey(secret));
builder.generateEvent(result);
const signed = await builder.signEvent(Array.from(secret, (byte) => byte.toString(16).padStart(2, '0')).join(''));
assert(verifyEvent(signed), 'Monitor event signature invalid');
assert(signed.tags.some((tag: string[]) => tag[0] === 'n' && tag[1] === 'fips'), 'Monitor event lost FIPS network');
console.log('FIPS_MONITOR_PROOF ' + JSON.stringify({
  url, network: result.network, open: result.open.data, read: result.read.data,
  write: result.write.data, nip11: result.info.data.name, publicDnsSkipped: true,
  signedEvent: signed,
}));
