import Dexie, { Table } from 'dexie';

Dexie.debug = true;

// Define interfaces for your data
export interface IEvent {
  nid: string;
  rid: number;
  monitorPubkey: string;
  relay?: string | null;
  event: any; // Assuming NostrEvent is correctly defined elsewhere
  createdAt: number | null;
}

// Define other interfaces as needed
export interface IRelay {
  rid: string;
  lastSeen: number;
  score: number;
}

export interface ICheck {
  nid: string;
  rid: number;
  monitorPubkey: string;
  operatorPubkey: string;
  network: string;
  category: string;
  open: number;
  read: number;
  write: number;
  geohash: string;
  geocode: string[];
  supportedNips: string[];
  paymentRequired: boolean;
  authRequired: boolean;
  software: string;
  version: string;
  validTo: number;
  issuer: string;
  ipv4: string;
  ipv6: string;
  isp: string;
  createdAt: number;
}

export interface INip11 {
  rid: number;
  monitorPubkey: string;
  hash: string;
  nid: string;
  json: string;
}

export interface IGlobalRtt {
  rid: number;
  monitorPubkeys: string[];
  operatorPubkey: string;
  avgAll: number;
  avgOpen: number;
  avgRead: number;
  avgWrite: number;
  createdAt: number;
}

// Define the database class
export class RelayDb extends Dexie {
  relays!: Table<IRelay, string>;
  checks!: Table<ICheck, string>;
  pastChecks!: Table<ICheck, string>;
  nip11s!: Table<INip11, string>;
  events!: Table<IEvent, string>;
  globalRtts!: Table<IGlobalRtt, string>;

  static indices: Record<string, string> = {
    relays: `&rid, lastSeen, score`,
    checks: `&nid, [rid+monitorPubkey], monitorPubkey, operatorPubkey, network, category, open, read, write, geohash, *geocode, *supportedNips, paymentRequired, authRequired, software, version, validTo, issuer, ipv4, ipv6, isp, createdAt`,
    pastChecks: `&nid, [rid+monitorPubkey], monitorPubkey, operatorPubkey, createdAt`,
    nip11s: `[rid+monitorPubkey], monitorPubkey, hash, nid, json`,
    events: `&nid, monitorPubkey, createdAt`,
    geocodes: `&id++, [type+format+type+length], [type+format+type],[format+type], code, type, format, length`,
    globalRtts: `&rid, *monitorPubkeys, operatorPubkey, avgAll, avgOpen, avgRead, avgWrite, createdAt`
  };

  constructor() {
    super("RelayDb");

    // Enhanced error handling during initialization
    try {
      this.version(1).stores(RelayDb.indices);
    } catch (error) {
      console.error('Dexie Initialization Error:', error);
      alert('Dexie Initialization Error: ' + error.message);
    }

    // Add custom error handling
    this.on('error', (error) => {
      console.error('Dexie Error:', error);
      alert('Dexie Error: ' + error.message);
    });
  }
}

// Initialize the database
const db = new RelayDb();

// Function to add an event and catch detailed errors
async function addExampleEvent(db: RelayDb) {
  const exampleEvent: IEvent = {
    nid: '57e014a4fc9cd23971aa6e5c048fa9314148c63eb072a14753accb89c16839d8',
    rid: 825000170,
    monitorPubkey: '9b85d54cc4bc886d60782f80d676e41bc637ed3ecc73d2bb5aabadc499d6a340',
    relay: 'wss://nproxy.kristapsk.lv/',
    event: {
      created_at: 1720442141,
      content: '',
      tags: [
        ['d', 'wss://nproxy.kristapsk.lv/'],
        ['other', 'network', 'clearnet'],
        ['rtt', 'open', '1018'],
        ['rtt', 'read', '2702']
      ],
      kind: 30066,
      pubkey: '9b85d54cc4bc886d60782f80d676e41bc637ed3ecc73d2bb5aabadc499d6a340',
      id: '57e014a4fc9cd23971aa6e5c048fa9314148c63eb072a14753accb89c16839d8',
      sig: 'dc676a1702c8edf49c2bae4e9d396a5b2a2a2b13c5baa45aecfd9c4a795066c27c36204a07ca8037aea10969158a6d8a2b22c6492afaa1815cd0d4aa0f6eb561'
    },
    createdAt: 1720442141
  };

  try {
    await db.transaction('rw', db.events, async () => {
      await db.events.add(exampleEvent);
    });
  } catch (error) {
    console.error('Transaction Error:', error);
    alert('Transaction Error: ' + error.message);
  }
}

// Example usage
addExampleEvent(db);
