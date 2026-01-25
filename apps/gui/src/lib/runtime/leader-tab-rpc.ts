import { getLeaderTabRpcClient } from './leader-tab-client';
import type { LeaderTabRpcOp, LeaderTabRpcOpMap } from './leader-tab-protocol';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function leaderRpcCall<K extends LeaderTabRpcOp>(
  op: K,
  args: LeaderTabRpcOpMap[K]['args'],
  options: { timeoutMs?: number } = {}
): Promise<LeaderTabRpcOpMap[K]['result']> {
  const client = getLeaderTabRpcClient();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const delays = [0, 50, 150, 400];

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt]);
    try {
      return await client.call(op, args, { timeoutMs });
    } catch (e) {
      lastError = e;
      try {
        await client.waitForLeader({ timeoutMs: 2_500 });
      } catch {
        // ignore; next retry handles it
      }
    }
  }

  throw lastError ?? new Error(`Leader RPC failed: ${op}`);
}

