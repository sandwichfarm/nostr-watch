/** Pause between warmup passes, so a pass that finds only rows that keep
 * coming back (or new rows trickling in) can never spin the event loop. */
export const WARMUP_PASS_DELAY_MS = 1000;

export interface WarmupDeps {
  /** URLs of relays that have never been checked (checked_at = -1). */
  selectUnchecked(): string[];
  /** Queue one first check. Must not throw for a failed check. */
  enqueue(url: string): void;
  /** Resolve once every queued check has settled. */
  waitIdle(): Promise<void>;
  /** Interruptible delay used between passes. */
  wait(ms: number): Promise<void>;
  running(): boolean;
  /** Called at the start of each pass that has work. */
  onPass?(pass: { pass: number; urls: number; skipped: number }): void;
  passDelayMs?: number;
}

export interface WarmupOutcome {
  passes: number;
  attempted: number;
  /** Rows still unchecked at exit that warmup will not retry: already
   * attempted once, or malformed. The regular check loop owns them. */
  leftUnchecked: number;
}

/**
 * Check every relay that has never been checked, once.
 *
 * Each URL is attempted at most once per warmup. A row whose check fails
 * without leaving the unchecked set (an older worker, a DB error, a shutdown
 * rejection) is handed to the regular check loop instead of being selected
 * again immediately, which previously spun at ~100 passes/s on a single
 * uncheckable URL and starved /healthz. Passes are also separated by a delay.
 */
export async function runWarmupPasses(
  deps: WarmupDeps,
): Promise<WarmupOutcome> {
  const attempted = new Set<string>();
  const delayMs = deps.passDelayMs ?? WARMUP_PASS_DELAY_MS;
  let passes = 0;
  let leftUnchecked = 0;
  while (deps.running()) {
    const unchecked = deps.selectUnchecked();
    const urls = unchecked.filter((url) =>
      typeof url === "string" && !url.includes("|") && !attempted.has(url)
    );
    leftUnchecked = unchecked.length - urls.length;
    if (urls.length === 0) break;
    passes++;
    deps.onPass?.({ pass: passes, urls: urls.length, skipped: leftUnchecked });
    for (const url of urls) {
      if (!deps.running()) break;
      attempted.add(url);
      deps.enqueue(url);
    }
    await deps.waitIdle();
    if (!deps.running()) break;
    await deps.wait(delayMs);
  }
  return { passes, attempted: attempted.size, leftUnchecked };
}
