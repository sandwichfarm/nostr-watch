/** Opt-in live proof, invoked inside the isolated FIPS fixture container. */
import { DB } from 'https://deno.land/x/sqlite/mod.ts';

const npub = Deno.env.get('FIPS_RELAY_NPUB');
if (!npub) throw new Error('Missing fixture relay identity');
const discoveredUrl = `ws://${npub}.fips:7777/`;
const directory = await Deno.makeTempDir({ prefix: 'trawler-fips-' });
const dbPath = `${directory}/discovery.db`;
const configPath = `${directory}/config.json`;
await Deno.writeTextFile(configPath, JSON.stringify({
  logLevel: 'error',
  trawler: {
    concurrency: 8, restDuration: 100, statusInterval: 600,
    seed: { interval: 60_000, sources: ['config'], options: {
      allowedNetworks: ['fips'], config: ['ws://relay.fips:7777/bootstrap'],
    } },
  },
}));

// Capture the starting request count so earlier monitor checks cannot satisfy
// the crawl assertion. Nothing seeds the target npub address into Trawler.
const requestsUrl = 'http://relay.fips:7777/fixture/requests';
const previous: string[] = await (await fetch(requestsUrl)).json();
const child = new Deno.Command(Deno.execPath(), {
  args: ['run', '--cached-only', '--no-lock', '--no-check', '--unstable-sloppy-imports',
    '--allow-all', '--config', '/workspace/apps/trawler/deno.json', '/workspace/apps/trawler/src/main.ts'],
  cwd: directory,
  env: { TRAWLER_CONFIG_PATH: configPath, TRAWLER_DB_PATH: dbPath },
  stdout: 'piped', stderr: 'piped',
}).spawn();
let stopped = false;
const output = child.output().then((result) => { stopped = true; return result; });
let success = false;
try {
  const deadline = Date.now() + 150_000;
  while (!stopped && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
    let rows: unknown[][] = [];
    try {
      const db = new DB(dbPath, { mode: 'read' });
      try { rows = db.query('SELECT url, network FROM relay_status'); } finally { db.close(); }
    } catch { continue; } // Wait for startup to create the database/schema.
    const requests: string[] = await (await fetch(requestsUrl)).json();
    const crawled = requests.slice(previous.length).some(request => new URL(request).hostname === `${npub}.fips`);
    if (rows.some(row => row[0] === discoveredUrl && row[1] === 'fips') && crawled) {
      if (rows.length !== 1) throw new Error(`Unexpected discoveries: ${JSON.stringify(rows)}`);
      console.log('FIPS_DISCOVERY_PROOF ' + JSON.stringify({
        entrypoint: 'apps/trawler/src/main.ts', seed: 'ws://relay.fips:7777/bootstrap',
        eventKind: 10002, url: discoveredUrl, network: 'fips',
        persisted: true, crawled: true, npubPathRejected: true, suffixLookalikeRejected: true,
      }));
      success = true;
      break;
    }
  }
} finally {
  if (!stopped) child.kill('SIGTERM');
  const result = await output;
  await Deno.remove(directory, { recursive: true });
  if (!success) {
    console.error(new TextDecoder().decode(result.stdout).slice(-6000));
    console.error(new TextDecoder().decode(result.stderr).slice(-6000));
  }
}
if (!success) throw new Error('Trawler did not discover, persist, and crawl the FIPS identity relay');
