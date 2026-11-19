/** Keeps passes over rows that keep coming back from spinning the event loop. */
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
  /** Unchecked rows left to the regular check loop. */
  leftUnchecked: number;
}

/**
 * Check every never-checked relay at most once. A URL that stays unchecked
 * after its attempt is left to the regular check loop, not retried here.
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
