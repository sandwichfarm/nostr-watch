import { StateManager } from '@nostrwatch/route66';
import { derived, writable, type Readable } from 'svelte/store';

export type SeedBootStatus = 'idle' | 'in_progress' | 'complete' | 'error';

export type SeedBootStateV1 = {
  v: 1;
  status: SeedBootStatus;
  startedAt?: number;
  completedAt?: number;
  generatedAt?: string;
  error?: string;
};

// SECURITY (v2.5.1): bumped from v1 to v2 to drop poisoned `aggregate:complete` and
// `aggregate:relayNip11Validations` localStorage entries from builds before commit 9df89519.
// Old v1 key remains untouched; new v2 key forces a re-seed on next visit which overwrites
// the aggregate caches with sanitized values.
const SEED_BOOT_STATE_KEY = 'boot:seed:v2';

function storageKey(key: string): string {
  const prefix = (StateManager as any)?.localStorage?.prefix ?? 'state';
  return `${prefix}:${key}`;
}

function normalizeSeedBootState(raw: unknown): SeedBootStateV1 {
  if (!raw || typeof raw !== 'object') return { v: 1, status: 'idle' };
  const anyRaw = raw as any;
  if (anyRaw.v !== 1) return { v: 1, status: 'idle' };
  const status: SeedBootStatus =
    anyRaw.status === 'in_progress' || anyRaw.status === 'complete' || anyRaw.status === 'error'
      ? anyRaw.status
      : 'idle';
  const next: SeedBootStateV1 = { v: 1, status };
  if (typeof anyRaw.startedAt === 'number') next.startedAt = anyRaw.startedAt;
  if (typeof anyRaw.completedAt === 'number') next.completedAt = anyRaw.completedAt;
  if (typeof anyRaw.generatedAt === 'string') next.generatedAt = anyRaw.generatedAt;
  if (typeof anyRaw.error === 'string') next.error = anyRaw.error;
  return next;
}

function readSeedBootState(): SeedBootStateV1 {
  try {
    return normalizeSeedBootState(StateManager.get(SEED_BOOT_STATE_KEY));
  } catch {
    return { v: 1, status: 'idle' };
  }
}

export const seedBootState = writable<SeedBootStateV1>(readSeedBootState());

export const seedBootStatus: Readable<SeedBootStatus> = derived(seedBootState, ($state) => $state.status);

export function setSeedBootInProgress(): void {
  const next: SeedBootStateV1 = { v: 1, status: 'in_progress', startedAt: Date.now() };
  try {
    StateManager.set(SEED_BOOT_STATE_KEY, next);
  } catch {}
  seedBootState.set(next);
}

export function setSeedBootComplete(generatedAt?: string): void {
  const next: SeedBootStateV1 = {
    v: 1,
    status: 'complete',
    completedAt: Date.now(),
    ...(typeof generatedAt === 'string' ? { generatedAt } : {}),
  };
  try {
    StateManager.set(SEED_BOOT_STATE_KEY, next);
  } catch {}
  seedBootState.set(next);
}

export function setSeedBootError(error: unknown): void {
  const next: SeedBootStateV1 = {
    v: 1,
    status: 'error',
    completedAt: Date.now(),
    error: error instanceof Error ? error.message : String(error),
  };
  try {
    StateManager.set(SEED_BOOT_STATE_KEY, next);
  } catch {}
  seedBootState.set(next);
}

export function resetSeedBootState(): void {
  try {
    StateManager.remove(SEED_BOOT_STATE_KEY);
  } catch {}
  seedBootState.set({ v: 1, status: 'idle' });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key) return;
    if (event.key !== storageKey(SEED_BOOT_STATE_KEY)) return;
    seedBootState.set(readSeedBootState());
  });
}
