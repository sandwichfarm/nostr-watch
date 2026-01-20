import sqlite3InitModule, { Database, SAHPoolUtil, Sqlite3Static } from "@sqlite.org/sqlite-wasm";
import { EventEmitter } from "eventemitter3";
import { EventMetadata, NostrEvent, RelayHandler, RelayHandlerEvents, ReqFilter, unixNowMs } from "../types";
import migrate from "./migrations";
import { debugLog } from "../debug";

// import wasm file directly, this needs to be copied from https://sqlite.org/download.html
import SqlitePath from "./sqlite3.wasm?url";
import { runFixers } from "./fixers";
import { batchNip11s, Nip11Args } from "interface";

const OPFS_INIT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => Error): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(onTimeout()), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export class SqliteRelay extends EventEmitter<RelayHandlerEvents> implements RelayHandler {
  #sqlite?: Sqlite3Static;
  #log = (msg: string, ...args: Array<any>) => debugLog("SqliteRelay", msg, ...args);
  db?: Database;
  #pool?: SAHPoolUtil;
  #seenInserts = new Set<string>();

  /**
   * Initialize the SQLite driver
   */
  async init(path: string) {
    this.#log('WebAssembly.instantiateStreaming', typeof WebAssembly?.instantiateStreaming !== undefined ? 'Supported' : 'Not Supported');
    if (this.#sqlite) return;
    this.#sqlite = await sqlite3InitModule({
      locateFile: (path, prefix) => {
        if (path === "sqlite3.wasm") {
          return SqlitePath;
        }
        return prefix + path;
      },
      print: msg => this.#log(msg),
      printErr: msg => this.#log(msg),
    });
    this.#log(`Got SQLite version: ${this.#sqlite.version.libVersion}`);
    await this.#open(path);
    if (this.db) {
      await migrate(this);
      runFixers(this);
    }
  }

  /**
   * Open the database from its path
   */
  async #open(path: string) {
    if (!this.#sqlite) throw new Error("Must call init first");
    if (this.db) return;

    this.#pool = await withTimeout(
      this.#sqlite.installOpfsSAHPoolVfs({}),
      OPFS_INIT_TIMEOUT_MS,
      () => {
        const err = new Error(`Timed out waiting for OPFS SAH pool VFS (${OPFS_INIT_TIMEOUT_MS}ms)`);
        (err as any).code = "OPFS_TIMEOUT";
        return err;
      },
    );
    this.db = new this.#pool.OpfsSAHPoolDb(path);
    this.#log(`Opened ${this.db.filename}`);
  }

  async dumpNip11s(): Promise<any[]> {
    if (!this.db) return [];
    try {
      const rows = this.db.selectArrays(`SELECT json FROM nip11s`) ?? [];
      return rows
        .map((row) => {
          const raw = row?.[0];
          if (typeof raw !== "string") return undefined;
          try {
            return JSON.parse(raw);
          } catch {
            return undefined;
          }
        })
        .filter(Boolean) as any[];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async countUniqueNip11s(): Promise<number> {
    if (!this.db) return 0;
    try {
      const res = this.db.selectArrays(`SELECT COUNT(*) FROM nip11s`);
      const count = res?.at(0)?.at(0);
      return typeof count === "number" ? count : Number(count ?? 0);
    } catch (e) {
      console.error(e);
      return 0;
    }
  }

  async countNip11s(): Promise<number> {
    if (!this.db) return 0;
    try {
      const res = this.db.selectArrays(`SELECT COUNT(*) FROM relay_nip11s`);
      const count = res?.at(0)?.at(0);
      return typeof count === "number" ? count : Number(count ?? 0);
    } catch (e) {
      console.error(e);
      return 0;
    }
  }

  async batchUpsertNip11(relayNip11s: batchNip11s): Promise<boolean> {
    if (!this.db) return false;
    try {
      this.db.transaction((db) => {
        for (const { relay, nip11 } of relayNip11s) {
          const hash = deterministicHash(nip11);
          db.exec(`INSERT OR REPLACE INTO nip11s(hash, json) VALUES(?,?)`, {
            bind: [hash, JSON.stringify(nip11)],
          });
          db.exec(`DELETE FROM relay_nip11s WHERE relay = ?`, {
            bind: [relay],
          });
          db.exec(`INSERT OR REPLACE INTO relay_nip11s(relay, hash) VALUES(?,?)`, {
            bind: [relay, hash],
          });
        }
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async upsertNip11(nip11Args: Nip11Args): Promise<boolean> {
    return await this.batchUpsertNip11([nip11Args]);
  }

  async getNip11(relay: string) {
    if (!this.db) return undefined;
    try {
      const res = this.db.selectArrays(
        `SELECT nip11s.json
        FROM relay_nip11s
        JOIN nip11s ON nip11s.hash = relay_nip11s.hash
        WHERE relay_nip11s.relay = ?
        ORDER BY relay_nip11s.rowid DESC
        LIMIT 1`,
        [relay],
      );
      const raw = res?.at(0)?.at(0);
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async recreate(){
    await this.destroy();
    await this.init(this.db?.filename ?? "");
  }

  async destroy(){
    if (this.#pool && this.db) {
      const root = await navigator.storage.getDirectory();
      try {
        this.close();
      }
      catch(e: any){
        console.warn("Failed to close database", e);
      }
      finally {
        await root.removeEntry(this.db.filename);
      }
    }
  }

  /**
   * Delete all data
   */
  async wipe() {
    if (this.#pool && this.db) {
      const dbName = this.db.filename;
      this.close();
      await this.#pool.wipeFiles();
      await this.#open(dbName);
      await migrate(this);
    }
  }

  close() {
    this.db?.close();
    this.db = undefined;
  }

  /**
   * Insert an event to the database
   */
  event(ev: NostrEvent) {
    if (this.#insertEvent(this.db!, ev)) {
      this.#log(`Inserted: kind=${ev.kind},authors=${ev.pubkey},id=${ev.id}`);
      this.emit("event", [ev]);
      return true;
    }
    return false;
  }

  sql(sql: string, params: Array<any>) {
    return this.db?.selectArrays(sql, params) as Array<Array<string | number>>;
  }

  /**
   * Write multiple events
   */
  eventBatch(evs: Array<NostrEvent>) {
    const start = unixNowMs();
    let eventsInserted: Array<NostrEvent> = [];
    this.db?.transaction(db => {
      for (const ev of evs) {
        if (this.#insertEvent(db, ev)) {
          eventsInserted.push(ev);
        }
      }
    });
    if (eventsInserted.length > 0) {
      this.#log(`Inserted Batch: ${eventsInserted.length}/${evs.length}, ${(unixNowMs() - start).toLocaleString()}ms`);
      this.emit("event", eventsInserted);
    }
    return eventsInserted.length > 0;
  }

  setEventMetadata(id: string, meta: EventMetadata) {
    if (meta.seen_at) {
      this.db?.exec("update events set seen_at = ? where id = ?", {
        bind: [meta.seen_at, id],
      });
    }
  }

  #deleteById(db: Database, ids: Array<string>) {
    if (ids.length === 0) return;
    try {
      db.exec(`delete from events where id in (${this.#repeatParams(ids.length)})`, {
        bind: ids,
      });
      const deleted = db.changes();
      db.exec(`delete from search_content where id in (${this.#repeatParams(ids.length)})`, {
        bind: ids,
      });
      this.#log("Deleted", ids, deleted);
    }
    catch (e) {
      console.error(e);
    }
  }

  #insertEvent(db: Database, ev: NostrEvent) {
    if (this.#seenInserts.has(ev.id)) return false;
    try {
      const legacyReplaceableKinds = [0, 3, 41];

      // Handle legacy and standard replaceable events (kinds 0, 3, 41, 10000-19999)
      if (legacyReplaceableKinds.includes(ev.kind) || (ev.kind >= 10_000 && ev.kind < 20_000)) {
        const oldEvents = db.selectValues(
          `SELECT id FROM events WHERE kind = ? AND pubkey = ? AND created <= ?`,
          [ev.kind, ev.pubkey, ev.created_at]
        ) as Array<string>;

        if (oldEvents.includes(ev.id)) {
          // Already have this event
          this.#seenInserts.add(ev.id);
          return false;
        } else {
          // Delete older events of the same kind and pubkey
          this.#deleteById(db, oldEvents);
        }
      }

      // Handle parameterized replaceable events (kinds 30000-39999)
      if (ev.kind >= 30_000 && ev.kind < 40_000) {
        const dTag = ev.tags.find(a => a[0] === "d")?.[1] ?? "";

        const oldEvents = db.selectValues(
          `SELECT e.id
          FROM events e
          JOIN tags t ON e.id = t.event_id
          WHERE e.kind = ? AND e.pubkey = ? AND t.key = ? AND t.value = ? AND created <= ?`,
          [ev.kind, ev.pubkey, "d", dTag, ev.created_at]
        ) as Array<string>;

        if (oldEvents.includes(ev.id)) {
          // Already have this event
          this.#seenInserts.add(ev.id);
          return false;
        } else {
          // Delete older events with the same kind, pubkey, and d tag
          this.#deleteById(db, oldEvents);
        }
      }

      // Proceed to insert the new event
      const evInsert = { ...ev };
      delete evInsert["relays"]; // Remove non-DB fields

      db.exec(
        `INSERT OR IGNORE INTO events(id, pubkey, created, kind, json, relays) 
        VALUES(?,?,?,?,?,?)`,
        {
          bind: [
            ev.id,
            ev.pubkey,
            ev.created_at,
            ev.kind,
            JSON.stringify(evInsert),
            (ev.relays ?? []).join(","),
          ],
        }
      );

      const insertedEvents = db.changes();
      if (insertedEvents > 0) {
        // Insert tags
        for (const t of ev.tags.filter(a => a[0].length === 1)) {
          db.exec("INSERT INTO tags(event_id, key, value) VALUES(?, ?, ?)", {
            bind: [ev.id, t[0], t[1]],
          });
        }
        this.insertIntoSearchIndex(db, ev);
      } else {
        this.#updateRelays(db, ev);
        return false;
      }

      this.#seenInserts.add(ev.id);
      return true;
    }
    catch(e) {
      console.error('event:', ev, e);
      return false;
    }
  }

  /**
   * Append relays
   */
  #updateRelays(db: Database, ev: NostrEvent) {
    const relays = db.selectArrays("select relays from events where id = ?", [ev.id]);
    const oldRelays = new Set((relays?.at(0)?.at(0) as string | null)?.split(",") ?? []);
    let hasNew = false;
    for (const r of ev.relays ?? []) {
      if (!oldRelays.has(r)) {
        oldRelays.add(r);
        hasNew = true;
      }
    }
    if (hasNew) {
      try {
        db.exec("update events set relays = ? where id = ?", {
          bind: [[...oldRelays].join(","), ev.id],
        });
      }
      catch (e) {
        console.error(e);
      }

    }
  }

  /**
   * Query relay by nostr filter
   */
  req(id: string, req: ReqFilter) {


    const start = unixNowMs();

    const [sql, params] = this.#buildQuery(req);
    const res = this.db?.selectArrays(sql, params);
    
    if(!res?.length) return [];

    const results = res?.map(a => {
        if (req.ids_only === true) {
          return a[0] as string;
        }
        return JSON.parse(a[0] as string) as NostrEvent
      });
      
    if(!results?.length) return [];
    const time = unixNowMs() - start;
    this.#log(`Query ${id} results took ${time.toLocaleString()}ms`, req, `${results?.length} results`);

    return results;
  }

  /**
   * Count results by nostr filter
   */
  count(req: ReqFilter) {

    const start = unixNowMs();
    const [sql, params] = this.#buildQuery(req, true);
    const rows = this.db?.exec(sql, {
      bind: params,
      returnValue: "resultRows",
    });

    if(req?.['#n']){
      console.log('count:sql', sql, params)
      console.log('count:rows', rows)
    }

    const results = (rows?.at(0)?.at(0) as number | undefined) ?? 0;

    const time = unixNowMs() - start;
    this.#log(`Query count results took ${time.toLocaleString()}ms`);
    return results;
  }

  /**
   * Delete events by nostr filter
   */
  delete(req: ReqFilter) {
    this.#log(`Starting delete of ${JSON.stringify(req)}`);
    const start = unixNowMs();
    const for_delete = this.req("ids-for-delete", { ...req, ids_only: true }) as Array<string>;

    const grouped = for_delete.reduce(
      (acc, v, i) => {
        const batch = (i / 1000).toFixed(0);
        acc[batch] ??= [];
        acc[batch].push(v);
        return acc;
      },
      {} as Record<string, Array<string>>,
    );
    this.#log(`Starting delete of ${Object.keys(grouped).length} batches`);
    Object.entries(grouped).forEach(([batch, ids]) => {
      this.#deleteById(this.db!, ids);
    });
    const time = unixNowMs() - start;
    this.#log(`Delete ${for_delete.length} events took ${time.toLocaleString()}ms`);
    return for_delete;
  }

  /**
   * Get a summary about events table
   */
  summary() {
    const res = this.db?.exec("select kind, count(*) from events group by kind", {
      returnValue: "resultRows",
    });
    return Object.fromEntries(res?.map(a => [String(a[0]), a[1] as number]) ?? []);
  }

  /**
   * Dump the database file
   */
  async dump() {
    const filePath = String(this.db?.filename ?? "");
    if (this.db && this.#pool) {
      try {
        return await this.#pool.exportFile(`/${filePath}`);
      } catch (e) {
        console.error(e);
      } finally {
        await this.#open(filePath);
      }
    }
    return new Uint8Array();
  }

  #buildQuery(req: ReqFilter, count = false, remove = false): [string, Array<any>] {
    const conditions: Array<string> = [];
    const params: Array<any> = [];

    let resultType = "json,relays";
    if (count) {
      resultType = "count(json)";
    } else if (req.ids_only === true) {
      resultType = "id";
    }
    let operation = `select ${resultType}`;
    if (remove) {
      operation = "delete";
    }
    let sql = `${operation} from events`;
    const orTags = Object.entries(req).filter(([k]) => k.startsWith("#"));
    let tx = 0;
    for (const [key, values] of orTags) {
      const vArray = values as Array<string>;
      sql += ` inner join tags t_${tx} on events.id = t_${tx}.event_id and t_${tx}.key = ? and t_${tx}.value in (${this.#repeatParams(
        vArray.length,
      )})`;
      params.push(key.slice(1));
      params.push(...vArray);
      tx++;
    }
    const andTags = Object.entries(req).filter(([k]) => k.startsWith("&"));
    for (const [key, values] of andTags) {
      const vArray = values as Array<string>;
      for (const value of vArray) {
        sql += ` inner join tags t_${tx} on events.id = t_${tx}.event_id and t_${tx}.key = ? and t_${tx}.value = ?`;
        params.push(key.slice(1));
        params.push(value);
        tx++;
      }
    }
    if (req.search) {
      sql += " inner join search_content on search_content.id = events.id";
      conditions.push("search_content match ?");
      params.push(req.search.replaceAll(".", "+").replaceAll("@", "+"));
    }
    if (req.ids) {
      conditions.push(`id in (${this.#repeatParams(req.ids.length)})`);
      params.push(...req.ids);
    }
    if (req.authors) {
      conditions.push(`pubkey in (${this.#repeatParams(req.authors.length)})`);
      params.push(...req.authors);
    }
    if (req.kinds) {
      conditions.push(`kind in (${this.#repeatParams(req.kinds.length)})`);
      params.push(...req.kinds);
    }
    if (req.since) {
      conditions.push("created >= ?");
      params.push(req.since);
    }
    if (req.until) {
      conditions.push("created < ?");
      params.push(req.until);
    }
    if (conditions.length > 0) {
      sql += ` where ${conditions.join(" and ")}`;
    }
    if (req.limit) {
      sql += ` order by created desc limit ${req.limit}`;
    }
    return [sql, params];
  }

  #repeatParams(n: number) {
    const ret: Array<string> = [];
    for (let x = 0; x < n; x++) {
      ret.push("?");
    }
    return ret.join(", ");
  }

  insertIntoSearchIndex(db: Database, ev: NostrEvent) {
    if (ev.kind === 0 && ev.content.length > 2) {
      let profile;
      try {
        profile = JSON.parse(ev.content) as {
          name?: string;
          display_name?: string;
          lud16?: string;
          nip05?: string;
          website?: string;
          about?: string;
        };
      } 
      catch(e){
        console.error(e);
      }
      if (profile) {
        const indexContent = [
          profile.name,
          profile.display_name,
          profile.about,
          profile.website,
          profile.lud16,
          profile.nip05,
        ].join(" ");
        try {
          db.exec("insert into search_content values(?,?)", {
            bind: [ev.id, indexContent],
          });
        }
        catch (e) {
          console.error(e);
        } 
      }
    } else if (ev.kind === 1) {
      try {
        db.exec("insert into search_content values(?,?)", {
          bind: [ev.id, ev.content],
        });
      }
      catch (e) {
        console.error(e);
      }
    }
  }

  #fixMissingTags(db: Database) {}
}


/**
 * Determines the type of the given value.
 */
function getType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regexp';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  return typeof value;
}

/**
* Serializes any JavaScript value into a deterministic string.
* Ensures that object keys are sorted to maintain consistency.
*/
function deterministicStringify(value: any): string {
  const seen = new WeakSet();

  function stringify(val: any): string {
      const type = getType(val);

      switch (type) {
          case 'undefined':
              return 'undefined';
          case 'null':
              return 'null';
          case 'boolean':
          case 'number':
          case 'bigint':
          case 'symbol':
              return val.toString();
          case 'string':
              return JSON.stringify(val);
          case 'date':
              return `Date:${val.toISOString()}`;
          case 'regexp':
              return `RegExp:${val.toString()}`;
          case 'function':
              return `Function:${val.toString()}`;
          case 'array':
              return `[${val.map((item: any) => stringify(item)).join(',')}]`;
          case 'map': {
              const mapEntries = Array.from(val.entries() as Iterable<[string, number]>).sort(([a], [b]) => {
                  if (a < b) return -1;
                  if (a > b) return 1;
                  return 0;
              });
          
              return `Map:{${mapEntries.map(([k, v]) => `${stringify(k)}=>${stringify(v)}`).join(',')}}`;
          }                     
          case 'set':
              const setEntries = Array.from(val.values()).sort();
              return `Set:{${setEntries.map(item => stringify(item)).join(',')}}`;
          case 'object':
              if (seen.has(val)) {
                  throw new TypeError('Converting circular structure to string');
              }
              seen.add(val);
              const keys = Object.keys(val).sort();
              const objString = `{${keys.map(key => `${JSON.stringify(key)}:${stringify(val[key])}`).join(',')}}`;
              seen.delete(val);
              return objString;
          default:
              return '';
      }
  }

  return stringify(value);
}

/**
* Implements the FNV-1a hash algorithm.
* Returns a hexadecimal string representation of the hash.
*/
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  const prime = 0x01000193; // FNV prime

  for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * prime) >>> 0;
  }

  // Convert to hexadecimal and pad with zeros if necessary
  return ('0000000' + hash.toString(16)).slice(-8);
}

/**
* Generates a deterministic hash for any given input.
* @param value The input value to hash.
* @returns A hexadecimal string representing the hash.
*/
export function deterministicHash(value: any): string {
  const serialized = deterministicStringify(value);
  return fnv1aHash(serialized);
}
