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

const logger = getLogger("Remediation");

const MIGRATION_NAME = "rerun_dedup_all_rows_v1";

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
          if (newIgnore && !storedIgnore) newlyIgnored++;
          else if (!newIgnore && storedIgnore) newlyUnignored++;
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
