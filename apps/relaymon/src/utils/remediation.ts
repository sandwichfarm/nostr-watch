/**
 * Phase 19 Remediation: Re-run dedup over every row in relay_status.
 *
 * Why this exists
 * ---------------
 * Pre-Phase-18, ~200 URL-path-mutation rows slipped past dedup and were
 * promoted into `relay_status` as `ignore=0, parent=''`. Phase 18 Fixes
 * 1–3 closed the bug going forward, but existing rows still carry the
 * wrong state. This one-shot startup migration walks every row and
 * re-evaluates it against the now-fixed `relayHostnameDedup`, writing
 * back any changes.
 *
 * Narrowness guarantee
 * --------------------
 * Every `(ignore, parent)` mutation flows through `relayHostnameDedup`.
 * There is NO independent decision logic in this file. A legit path-only
 * relay that `relayHostnameDedup` returns as `ignore=false` stays
 * `ignore=false`. A legit path-only relay WITH a matching-NIP-11 root
 * sibling will correctly be flipped to `ignore=true` — that IS the
 * dedup philosophy (shortest URL is canonical), not a regression.
 *
 * Idempotency
 * -----------
 * Guarded by the `rerun_dedup_all_rows_v1` sentinel row in the
 * `relaymon_migrations` table (created by Phase 18 Fix 2). First call
 * does the work and inserts the sentinel. Second call returns early.
 *
 * Ordering
 * --------
 * MUST run AFTER `rehashRelayInfoMigration()` so the re-dedup step sees
 * the stable, normalizeNip11-scrubbed hashes. See db.ts `initializeDB`.
 */

import { db, getRelayInfo } from "../db/db.ts";
import { relayHostnameDedup } from "./hostnames.ts";
import { getLogger } from "./logger.ts";
import type { RelayCheckResult } from "../types/relay.ts";
import type { NetworkType } from "../types/config.ts";
import type { Config } from "../types/config.ts";

const logger = getLogger("Remediation");

// Bumped to v2 after the synced-ignore-list override bug was fixed in
// relayHostnameDedup. v1 ran under the broken early-return, which meant
// every tainted-root row was short-circuited to ignore=true/parent=""
// instead of being re-evaluated by local logic. v2 forces a fresh pass
// so all rows see the corrected dedup path.
const MIGRATION_NAME = "rerun_dedup_all_rows_v2";

export async function rerunDedupForAllRowsMigration(): Promise<void> {
  // Top-level try: never let this migration crash startup.
  try {
    // Idempotency guard: sentinel row in relaymon_migrations means we
    // already ran on this DB. Return silently.
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
    const startTime = Date.now();

    // Iterate every row in relay_status regardless of online state. We
    // need `ignore_reason` and `network` from the row because we
    // construct a full RelayCheckResult to hand to relayHostnameDedup —
    // the function asserts required fields via TypeScript.
    const rows = db.query(
      `SELECT url, ignore, parent, online, ignore_reason, network, checked_at
       FROM relay_status`,
    );

    let evaluated = 0;
    let newlyIgnored = 0;
    let newlyUnignored = 0;
    let unchanged = 0;

    for (const row of rows) {
      const [
        urlRaw,
        storedIgnoreRaw,
        storedParentRaw,
        onlineRaw,
        ignoreReasonRaw,
        networkRaw,
        checkedAtRaw,
      ] = row;

      const url = urlRaw as string;
      const storedIgnore = (storedIgnoreRaw as number) === 1;
      const storedParent = (storedParentRaw as string) || "";
      const online = (onlineRaw as number) === 1;
      const ignoreReason = (ignoreReasonRaw as string) || "";
      const network = ((networkRaw as string) || "clearnet") as NetworkType;
      const checkedAt = (checkedAtRaw as number) || 0;

      evaluated++;

      try {
        // Parse the URL so we can fill in hostname and protocol —
        // relayHostnameDedup throws if these are missing.
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch (e) {
          logger.warn(
            `Skipping malformed URL in relay_status: ${url} (${e})`,
          );
          continue;
        }

        // Pull cached NIP-11 info if available. getRelayInfo returns
        // null for rows with no cached NIP-11 — that's fine, the
        // no-NIP-11 branch of relayHostnameDedup handles it.
        const cachedInfo = getRelayInfo(url);
        const infoForDedup = cachedInfo
          ? {
              data: cachedInfo.info,
              duration: 0,
            }
          : undefined;

        // Construct a minimal RelayCheckResult. relayHostnameDedup
        // mutates .ignore and .parent on this object and returns it.
        const result: RelayCheckResult = {
          url,
          hostname: parsed.hostname,
          protocol: parsed.protocol,
          checked_at: checkedAt,
          online,
          ignore: storedIgnore,
          ignore_reason: ignoreReason,
          parent: storedParent,
          network,
          info: infoForDedup,
        };

        const deduped = await relayHostnameDedup(result);

        const newIgnore = deduped.ignore;
        const newParent = deduped.parent || "";

        if (newIgnore !== storedIgnore || newParent !== storedParent) {
          db.query(
            `UPDATE relay_status SET ignore = ?, parent = ? WHERE url = ?`,
            [newIgnore ? 1 : 0, newParent, url],
          );
          if (newIgnore && !storedIgnore) {
            newlyIgnored++;
            // Queue a deletion event for the newly-ignored URL. The
            // daemon drains this queue after it has config + keys
            // available. We can't publish directly from inside this
            // migration because initializeDB runs before the daemon
            // wires setConfig / SimplePool / private key.
            const reason = newParent
              ? `Duplicate of ${newParent} (remediation)`
              : `Ignored by hostname dedup (remediation)`;
            enqueueRemediationDeletion(url, reason);
          } else if (!newIgnore && storedIgnore) {
            newlyUnignored++;
            // Un-ignored rows need no queue entry: kind:5 deletions are
            // one-way on nostr. IgnoreListSync.loadLocalIgnoresFromDB
            // will naturally exclude these rows when the daemon
            // constructs the sync instance AFTER this migration has
            // awaited to completion (see db.ts initializeDB order).
          }
          logger.info(
            `Remediation: ${url} ignore=${storedIgnore}/parent="${storedParent}" → ignore=${newIgnore}/parent="${newParent}"`,
          );
        } else {
          unchanged++;
        }
      } catch (e) {
        logger.error(
          `Remediation: failed to re-evaluate ${url}: ${e}`,
        );
      }
    }

    const durationMs = Date.now() - startTime;

    // Structured JSON summary — single greppable line. Field names
    // are stable for the operator's post-rollout grep.
    logger.info(
      JSON.stringify({
        migration: MIGRATION_NAME,
        rows_evaluated: evaluated,
        newly_ignored: newlyIgnored,
        newly_unignored: newlyUnignored,
        unchanged: unchanged,
        duration_ms: durationMs,
      }),
    );

    // Insert sentinel only after successful completion so a partial
    // run can be retried on next restart.
    db.query(
      `INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)`,
      [MIGRATION_NAME, Math.floor(Date.now() / 1000)],
    );

    logger.info(
      `Migration ${MIGRATION_NAME} complete: ${evaluated} evaluated, ${newlyIgnored} newly ignored, ${newlyUnignored} newly unignored, ${unchanged} unchanged, ${durationMs}ms`,
    );
  } catch (e) {
    logger.error(`Migration ${MIGRATION_NAME} failed: ${e}`);
    // Intentionally no rethrow — never crash startup.
  }
}

/**
 * Enqueue a URL for delayed kind:5 deletion publication. Called by the
 * remediation migration (which cannot publish directly because daemon
 * wiring hasn't happened yet) and available for any other code path
 * that wants a deletion published once wiring completes. Idempotent on
 * url via PRIMARY KEY — repeat calls just refresh the reason.
 */
export function enqueueRemediationDeletion(url: string, reason: string): void {
  try {
    db.query(
      `INSERT INTO remediation_deletion_queue (url, reason, queued_at, attempts)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(url) DO UPDATE SET reason = excluded.reason`,
      [url, reason, Math.floor(Date.now() / 1000)],
    );
  } catch (e) {
    logger.error(`enqueueRemediationDeletion failed for ${url}: ${e}`);
  }
}

/**
 * Drain the remediation_deletion_queue: publish a kind:5 deletion for
 * each queued URL and remove the row on successful OK. Called by the
 * daemon AFTER config / keys / SimplePool are wired up. Failures
 * increment the attempts counter and leave the row in place for the
 * next startup. Never throws — reports counts via a structured log
 * line and returns.
 */
export async function drainRemediationDeletionQueue(config: Config): Promise<void> {
  try {
    const rows = db.query(
      `SELECT url, reason, attempts FROM remediation_deletion_queue
       ORDER BY queued_at ASC`,
    );

    if (rows.length === 0) {
      logger.debug(`Deletion queue empty — nothing to drain`);
      return;
    }

    logger.info(`Draining remediation deletion queue: ${rows.length} entries`);
    const startTime = Date.now();
    let published = 0;
    let failed = 0;

    // Lazy import so unit tests and non-daemon code paths that never
    // drain the queue don't pay the deletion.ts import cost.
    const { deleteRelayCheckEvent } = await import("./deletion.ts");

    for (const row of rows) {
      const [urlRaw, reasonRaw, attemptsRaw] = row;
      const url = urlRaw as string;
      const reason = (reasonRaw as string) || "";
      const attempts = (attemptsRaw as number) || 0;

      try {
        const ok = await deleteRelayCheckEvent(url, reason, config);
        if (ok) {
          db.query(
            `DELETE FROM remediation_deletion_queue WHERE url = ?`,
            [url],
          );
          published++;
          logger.info(`Deletion published for ${url}: queue entry removed`);
        } else {
          db.query(
            `UPDATE remediation_deletion_queue
             SET attempts = ?, last_error = ?
             WHERE url = ?`,
            [attempts + 1, "deleteRelayCheckEvent returned false", url],
          );
          failed++;
          logger.warn(
            `Deletion NOT ACK'd for ${url} (attempts=${attempts + 1}) — left in queue`,
          );
        }
      } catch (e) {
        const errStr = String(e);
        db.query(
          `UPDATE remediation_deletion_queue
           SET attempts = ?, last_error = ?
           WHERE url = ?`,
          [attempts + 1, errStr.slice(0, 500), url],
        );
        failed++;
        logger.error(
          `Deletion threw for ${url} (attempts=${attempts + 1}): ${errStr}`,
        );
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      JSON.stringify({
        drain: "remediation_deletion_queue",
        published,
        failed,
        duration_ms: durationMs,
      }),
    );
  } catch (e) {
    logger.error(`drainRemediationDeletionQueue failed: ${e}`);
  }
}
