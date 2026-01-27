import { StateManager } from '@nostrwatch/route66';
import { get } from 'svelte/store';
import { tabState } from '$lib/stores/app';
import { getLeaderTabRpcClient } from '$lib/runtime/leader-tab-client';
import { leaderRpcCall } from '$lib/runtime/leader-tab-rpc';

export function stateManagerStorageKey(key: string): string {
  const prefix = (StateManager as any)?.localStorage?.prefix ?? 'state';
  return `${prefix}:${key}`;
}

export async function stateManagerSet(key: string, value: any, options: { timeoutMs?: number } = {}) {
  if (typeof window === 'undefined') return false;

  // In the leader tab, write directly and broadcast so followers update immediately.
  if (get(tabState) === 'leader') {
    try {
      StateManager.set(key, value);
    } catch {
      return false;
    }
    try {
      getLeaderTabRpcClient().broadcast('state.stateManager', { key, value });
    } catch {}
    return true;
  }

  // Followers ask the leader to persist, which also triggers a broadcast.
  // If the leader RPC server isn't available yet (startup/role transitions), avoid long
  // timeouts and fall back to a local write so navigation doesn't hang.
  try {
    await getLeaderTabRpcClient().waitForLeader({ timeoutMs: Math.min(750, options.timeoutMs ?? 5_000) });
  } catch {
    try {
      StateManager.set(key, value);
      return true;
    } catch {
      return false;
    }
  }

  try {
    return await leaderRpcCall('state.stateManagerSet', [key, value], {
      timeoutMs: options.timeoutMs ?? 5_000,
    });
  } catch {
    // Best-effort fallback: persist locally so at least `storage` events can sync.
    try {
      StateManager.set(key, value);
      return true;
    } catch {
      return false;
    }
  }
}
