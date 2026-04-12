/**
 * NATO Phonetic Spam Purge Migration (Phase 22)
 *
 * One-shot, sentinel-gated migration that identifies and deletes relay URLs
 * ending with 1-3 hyphen-separated NATO phonetic alphabet codes from
 * relay_status. Deleted URLs are written to a persistent file for downstream
 * NIP-09 processing.
 *
 * Examples of matched URLs:
 *   wss://relay.example.com/alpha
 *   wss://relay.example.com/bravo-charlie
 *   wss://relay.example.com/delta-echo-foxtrot
 *
 * Idempotent: uses a sentinel row in a migrations table. Safe to call
 * multiple times -- second+ calls are no-ops.
 */

import { db } from "./index.ts";
import Logger from "npm:@nostrwatch/logger";

const logger = new Logger("NatoPurge");

const MIGRATION_NAME = "purge_nato_phonetic_spam_v1";

const NATO_CODES = [
  "alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
  "golf", "hotel", "india", "juliet", "kilo", "lima",
  "mike", "november", "oscar", "papa", "quebec", "romeo",
  "sierra", "tango", "uniform", "victor", "whiskey", "xray",
  "yankee", "zulu",
] as const;

// Build a Set for O(1) lookups
const NATO_SET = new Set<string>(NATO_CODES);

/**
 * Check whether a relay URL ends with 1-3 hyphen-separated NATO phonetic
 * codes. The codes appear as the final path segment(s) of the URL.
 *
 * Strategy: parse the URL, extract the last path segment, split on "-",
 * verify each part is a NATO code and there are 1-3 parts.
 */
export function isNatoPhoneticSpam(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Get the pathname, strip trailing slash
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "/") return false;

    // Get the last segment after the final "/"
    const lastSegment = pathname.split("/").pop();
    if (!lastSegment) return false;

    // Split on hyphens
    const parts = lastSegment.split("-");
    if (parts.length < 1 || parts.length > 3) return false;

    // Every part must be a NATO code
    return parts.every((part) => NATO_SET.has(part.toLowerCase()));
  } catch {
    return false;
  }
}

/**
 * Purge NATO phonetic spam URLs from relay_status.
 *
 * @param purgedUrlsPath - Absolute path to write the list of deleted URLs.
 *   Each URL is written on its own line. File is created (not appended)
 *   on first run; subsequent calls are no-ops due to the sentinel.
 *   Defaults to "nato-purged-urls.txt" in the current working directory.
 */
export async function purgeNatoPhoneticSpam(
  purgedUrlsPath?: string,
): Promise<void> {
  const outputPath = purgedUrlsPath || "nato-purged-urls.txt";

  try {
    // Ensure migrations table exists (trawler DB may not have one)
    db.query(`
      CREATE TABLE IF NOT EXISTS relaymon_migrations (
        name TEXT PRIMARY KEY,
        applied_at INTEGER
      )
    `);

    // Idempotency guard: sentinel row means we already ran on this DB.
    const existing = db.query(
      `SELECT applied_at FROM relaymon_migrations WHERE name = ?`,
      [MIGRATION_NAME],
    );
    if (existing.length > 0) {
      logger.debug(
        `Migration ${MIGRATION_NAME} already applied, skipping`,
      );
      return;
    }

    logger.info(`Running migration: ${MIGRATION_NAME}`);

    // Fetch all URLs from relay_status
    const allUrls: string[] = [];
    for (const [url] of db.query("SELECT url FROM relay_status")) {
      allUrls.push(url as string);
    }

    logger.info(`Scanning ${allUrls.length} relay URLs for NATO phonetic spam`);

    // Identify NATO phonetic spam URLs
    const spamUrls = allUrls.filter(isNatoPhoneticSpam);

    logger.info(`Found ${spamUrls.length} NATO phonetic spam URLs`);

    if (spamUrls.length > 0) {
      // Delete from relay_status using db.query (established codebase pattern)
      for (const url of spamUrls) {
        db.query("DELETE FROM relay_status WHERE url = ?", [url]);
        logger.debug(`Deleted: ${url}`);
      }

      logger.info(
        `Deleted ${spamUrls.length} NATO phonetic spam URLs from relay_status`,
      );
    }

    // Write the list of purged URLs to disk (even if empty -- confirms
    // the migration ran). One URL per line.
    try {
      await Deno.writeTextFile(outputPath, spamUrls.join("\n") + "\n");
      logger.info(`Wrote purged URL list to ${outputPath}`);
    } catch (e) {
      logger.error(
        `Failed to write purged URL list to ${outputPath}: ${e}`,
      );
      // Non-fatal: the DB purge already happened. Log but continue
      // to insert the sentinel so we don't re-run and re-delete.
    }

    // Insert sentinel
    db.query(
      `INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)`,
      [MIGRATION_NAME, Date.now()],
    );

    logger.info(`Migration ${MIGRATION_NAME} complete`);
  } catch (e) {
    logger.error(`Migration ${MIGRATION_NAME} failed: ${e}`);
    throw e;
  }
}
