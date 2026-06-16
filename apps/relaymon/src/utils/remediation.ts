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

import { db, getOnlineRelays, getRelayInfo, clearDeltaState, clearPeriodSnapshots } from "../db/db.ts";
import { VERSION, qualifyRelayUrl } from "@nostrwatch/nostrings";
import { relayHostnameDedup } from "./hostnames.ts";
import { getLogger } from "./logger.ts";
import type { RelayCheckResult } from "../types/relay.ts";
import type { NetworkType } from "../types/config.ts";
import type { Config } from "../types/config.ts";

const logger = getLogger("Remediation");

// Phase 19 used MIGRATION_NAME = "rerun_dedup_all_rows_v2" which scanned
// every row in relay_status. Phase 20 (this file) narrows the scope to
// online+unignored rows at the SQL layer via a new sentinel — see below.
// The v2 constant is NOT retained because no code path references it
// after the rename. The v2 sentinel ROW in the relaymon_migrations table
// remains forever as a history record; the v2 NAME constant is gone.
//
// Phase 20 PERF-01: new sentinel so deployed DBs re-run under the new
// online+unignored scope. The Phase 19 sentinel "rerun_dedup_all_rows_v2"
// is LEFT IN PLACE as a history record — it is NEVER deleted, nor
// referenced below. Deployed DBs that already carry the v2 row will add
// this v1 row on first Phase 20 startup and carry both rows forever.
const MIGRATION_NAME = "rerun_dedup_online_unignored_v1";

// Sentinel for the nostrings sweep. Embeds the current nostrings
// VERSION so each library bump creates a fresh sentinel row and
// re-triggers the sweep exactly once per DB per version. See the spec
// at docs/superpowers/specs/2026-04-11-nostrings-sweep-migration-design.md
const NOSTRINGS_SWEEP_MIGRATION_NAME = `nostrings_sweep_v${VERSION}`;

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

    // Phase 20 PERF-01: SQL-layer scope narrowing. Only evaluate rows that
    // are currently online AND unignored. The ~30k row scan is reduced to
    // the hot set (typically a few thousand rows). Excluded rows:
    //   - offline rows: not candidates for ignore-flipping in this batch
    //     pass; when they come back online their next live check re-runs
    //     relayHostnameDedup naturally.
    //   - already-ignored rows: flipping an ignored row back to unignored
    //     would require an override rule to fire; the override path runs
    //     on every live check via relayHostnameDedup, so this batch does
    //     not need to revisit historically-ignored rows at startup scale.
    // We need `ignore_reason` and `network` from the row because we
    // construct a full RelayCheckResult to hand to relayHostnameDedup —
    // the function asserts required fields via TypeScript.
    const rows = db.query(
      `SELECT url, ignore, parent, online, ignore_reason, network, checked_at
       FROM relay_status
       WHERE online = 1 AND ignore = 0`,
    );

    let evaluated = 0;
    let newlyIgnored = 0;
    let newlyUnignored = 0;
    let unchanged = 0;

    // Phase 20 PERF-02: cache onlineUrls ONCE per migration run. Passed
    // into relayHostnameDedup via ctx on every per-row call so dedup does
    // not re-query the DB O(N) times. Safe because:
    //   1. initializeDB runs this migration BEFORE the daemon wires live
    //      checks — no concurrent writer can mutate `online` mid-run.
    //   2. This migration NEVER writes to relay_status.online — only to
    //      .ignore and .parent — so the snapshot cannot become stale
    //      against its own writes.
    // If a future refactor moves this migration to run concurrently with
    // live checks, this cache must become per-row (or be invalidated at
    // write boundaries). Document any such change in this comment.
    const cachedOnline = getOnlineRelays();
    logger.info(
      `Phase 20 PERF-02: cached ${cachedOnline.length} online URLs for migration run`,
    );

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

        // Phase 20 PERF-02: pass cached onlineUrls snapshot so dedup does
        // NOT re-query getOnlineRelays() on every row. See DedupContext in
        // hostnames.ts (Plan 20-03).
        const deduped = await relayHostnameDedup(result, {
          onlineUrls: cachedOnline,
        });

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
    // Phase 20: JSON summary includes `scope: "online_unignored"` for
    // post-rollout grepping so operators can distinguish Phase 19 runs
    // from Phase 20 runs in historical logs.
    logger.info(
      JSON.stringify({
        migration: MIGRATION_NAME,
        scope: "online_unignored",
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

// Offline-inclusive companion to rerunDedupForAllRowsMigration (which is scoped
// online+unignored): re-dedups ALL unignored rows so the offline backlog clears
// at boot rather than only at per-relay backoff. Separate sentinel keeps it
// additive.
const ALL_UNIGNORED_MIGRATION_NAME = "rerun_dedup_all_unignored_v1";

// Yield the loop every N rows so a large (~30k) scan can't block startup.
const YIELD_EVERY = 500;

/**
 * Re-run the dynamic hostname dedup over every unignored row (online AND
 * offline), persisting ignore/parent changes and queueing kind:5 deletions for
 * newly-ignored rows. Pure DB — uses stored NIP-11 only, never the network.
 * Idempotent via the `rerun_dedup_all_unignored_v1` sentinel.
 */
export async function rerunDedupAllUnignoredMigration(): Promise<void> {
  try {
    const existing = db.query(
      `SELECT applied_at FROM relaymon_migrations WHERE name = ?`,
      [ALL_UNIGNORED_MIGRATION_NAME],
    );
    if (existing.length > 0) {
      logger.debug(
        `Migration ${ALL_UNIGNORED_MIGRATION_NAME} already applied, skipping`,
      );
      return;
    }

    logger.info(`Running migration: ${ALL_UNIGNORED_MIGRATION_NAME}`);
    const startTime = Date.now();

    const rows = db.query(
      `SELECT url, ignore, parent, online, ignore_reason, network, checked_at
       FROM relay_status
       WHERE ignore = 0`,
    );

    let evaluated = 0;
    let newlyIgnored = 0;
    let unchanged = 0;
    let i = 0;

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
      if (++i % YIELD_EVERY === 0) {
        // Yield to the event loop between batches.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      try {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch (e) {
          logger.warn(`Skipping malformed URL in relay_status: ${url} (${e})`);
          continue;
        }

        const cachedInfo = getRelayInfo(url);
        const infoForDedup = cachedInfo
          ? { data: cachedInfo.info, duration: 0 }
          : undefined;

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
            const reason = newParent
              ? `Duplicate of ${newParent} (remediation)`
              : `Ignored by hostname dedup (remediation)`;
            enqueueRemediationDeletion(url, reason);
          }
          logger.info(
            `Remediation(all): ${url} ignore=${storedIgnore}/parent="${storedParent}" → ignore=${newIgnore}/parent="${newParent}"`,
          );
        } else {
          unchanged++;
        }
      } catch (e) {
        logger.error(`Remediation(all): failed to re-evaluate ${url}: ${e}`);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      JSON.stringify({
        migration: ALL_UNIGNORED_MIGRATION_NAME,
        scope: "all_unignored",
        rows_evaluated: evaluated,
        newly_ignored: newlyIgnored,
        unchanged,
        duration_ms: durationMs,
      }),
    );

    db.query(
      `INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)`,
      [ALL_UNIGNORED_MIGRATION_NAME, Math.floor(Date.now() / 1000)],
    );

    logger.info(
      `Migration ${ALL_UNIGNORED_MIGRATION_NAME} complete: ${evaluated} evaluated, ${newlyIgnored} newly ignored, ${unchanged} unchanged, ${durationMs}ms`,
    );
  } catch (e) {
    logger.error(`Migration ${ALL_UNIGNORED_MIGRATION_NAME} failed: ${e}`);
    // Never crash startup.
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

    // Throttle: 200ms between publishes to avoid relay rate-limiting.
    // At 5/sec, 20k entries drain in ~67 minutes — acceptable for a
    // one-shot migration that runs in the background at startup.
    const DRAIN_DELAY_MS = 200;

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

      // Throttle between publishes
      await new Promise((r) => setTimeout(r, DRAIN_DELAY_MS));
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

/**
 * Hard-delete a row from relay_status and all satellite tables in a
 * single SQLite transaction. Used by the nostrings sweep for rows
 * whose url is unparseable by `new URL()`. Satellite deletes must be
 * atomic with the relay_status delete so a crash mid-row cannot leave
 * orphaned rows in relay_info / relay_delta_state / relay_period_snapshots.
 *
 * The deno.land/x/sqlite binding does NOT expose a callback-style
 * `db.transaction(fn)` — BEGIN / COMMIT / ROLLBACK must be emitted via
 * `db.query(...)`. See the precedent at apps/relaymon/src/core/main.ts:196.
 *
 * `enqueueRemediationDeletion` is called AFTER the transaction commits:
 * it writes to a separate logical queue, is already idempotent on url,
 * and should not block the row-removal atomicity if the deletion
 * publisher subsystem is unavailable.
 */
function hardDeleteRow(url: string, reason: string): void {
  db.query("BEGIN TRANSACTION");
  try {
    db.query(`DELETE FROM relay_status WHERE url = ?`, [url]);
    db.query(`DELETE FROM relay_info   WHERE url = ?`, [url]);
    clearDeltaState(url);
    clearPeriodSnapshots(url);
    db.query("COMMIT");
  } catch (e) {
    db.query("ROLLBACK");
    throw e;
  }
  enqueueRemediationDeletion(url, reason);
  logger.info(`Nostrings sweep: hard-deleted ${url}`);
}

/**
 * Soft-ignore a row: keep it in relay_status as a tombstone so
 * IgnoreListSync will use it to short-circuit future re-ingestion of
 * the same URL string, but mark it ignored with a sweep-scoped reason.
 * Satellite tables are intentionally left intact — the row is still a
 * known entity, just one we refuse to check. A kind:5 deletion for any
 * previously-published relay-check event is queued for the daemon to
 * drain after wiring.
 */
function softIgnoreRow(url: string, reason: string): void {
  db.query(
    `UPDATE relay_status SET ignore = 1, ignore_reason = ? WHERE url = ?`,
    [reason, url],
  );
  enqueueRemediationDeletion(url, reason);
  logger.info(`Nostrings sweep: soft-ignored ${url}`);
}

/**
 * Re-run @nostrwatch/nostrings qualification over every row in
 * relay_status. Hard-deletes unparseable garbage, soft-ignores
 * parseable-but-disqualified URLs, leaves valid URLs alone. Idempotent
 * per nostrings VERSION via a sentinel row in relaymon_migrations.
 *
 * Ordering: MUST run AFTER rerunDedupForAllRowsMigration in initializeDB
 * because dedup operates on row identity and walks every row — adding
 * rows underneath it is unsafe, but this sweep only removes/ignores, so
 * appending it at the end is fine.
 *
 * Contract: never throws. Per-row errors are caught inside the loop so
 * one bad row cannot abort the sweep. Top-level try/catch swallows any
 * unexpected failure and logs it. Same "never crash startup" contract
 * as the existing migrations.
 */
export async function rerunNostringsSweepMigration(): Promise<void> {
  // Top-level try: never let this migration crash startup.
  try {
    // Idempotency guard: sentinel row in relaymon_migrations means we
    // already ran on this DB for the current nostrings VERSION. Return
    // silently. A nostrings version bump changes the sentinel name and
    // naturally re-triggers the sweep.
    const existing = db.query(
      `SELECT applied_at FROM relaymon_migrations WHERE name = ?`,
      [NOSTRINGS_SWEEP_MIGRATION_NAME],
    );
    if (existing.length > 0) {
      logger.debug(
        `Migration ${NOSTRINGS_SWEEP_MIGRATION_NAME} already applied, skipping`,
      );
      return;
    }

    logger.info(`Running migration: ${NOSTRINGS_SWEEP_MIGRATION_NAME}`);
    const startTime = Date.now();

    // Pull just the url column — we don't need anything else to decide.
    const rows = db.query(`SELECT url FROM relay_status`);

    let evaluated = 0;
    let hardDeleted = 0;
    let softIgnored = 0;
    let unchanged = 0;

    for (const [urlRaw] of rows) {
      const url = urlRaw as string;
      evaluated++;

      try {
        // Garbage-URL branch: unparseable → hard delete. qualifyRelayUrl
        // would also return false here, but we want the distinct
        // hard-delete action for "row should never have existed".
        let parseable = true;
        try {
          new URL(url);
        } catch {
          parseable = false;
        }

        if (!parseable) {
          hardDeleteRow(
            url,
            `Garbage URL rejected by nostrings v${VERSION}`,
          );
          hardDeleted++;
          continue;
        }

        // Disqualified-but-parseable branch: soft-ignore tombstone.
        // Keeps the row around so IgnoreListSync can short-circuit
        // future re-ingestion of the same string.
        if (!qualifyRelayUrl(url)) {
          softIgnoreRow(
            url,
            `Rejected by nostrings v${VERSION}: disqualified`,
          );
          softIgnored++;
          continue;
        }

        // Still valid under the current rules — leave alone.
        unchanged++;
      } catch (e) {
        // Per-row defensive catch: one bad row must not abort the
        // sweep. The specific failure mode we care about is a
        // transaction failure inside hardDeleteRow — rollback already
        // happened there, we just need to log and continue.
        logger.error(
          `Nostrings sweep: failed to evaluate ${url}: ${e}`,
        );
      }
    }

    const durationMs = Date.now() - startTime;

    // Structured JSON summary — single greppable line. Field names
    // stable for post-rollout grep.
    logger.info(
      JSON.stringify({
        migration: NOSTRINGS_SWEEP_MIGRATION_NAME,
        rows_evaluated: evaluated,
        hard_deleted: hardDeleted,
        soft_ignored: softIgnored,
        unchanged: unchanged,
        duration_ms: durationMs,
      }),
    );

    // Insert sentinel ONLY after successful completion so a partial
    // run (crash, SIGKILL) is retried on the next startup.
    db.query(
      `INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)`,
      [NOSTRINGS_SWEEP_MIGRATION_NAME, Math.floor(Date.now() / 1000)],
    );

    logger.info(
      `Migration ${NOSTRINGS_SWEEP_MIGRATION_NAME} complete: ${evaluated} evaluated, ${hardDeleted} hard-deleted, ${softIgnored} soft-ignored, ${unchanged} unchanged, ${durationMs}ms`,
    );
  } catch (e) {
    // Top-level: never crash startup.
    logger.error(`Migration ${NOSTRINGS_SWEEP_MIGRATION_NAME} failed: ${e}`);
  }
}
