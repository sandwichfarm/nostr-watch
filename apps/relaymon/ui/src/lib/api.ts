import type { HealthSnapshot, HealthzResponse } from './types.ts';

/**
 * Fetch the current config YAML from the server.
 * @returns { yaml: string } on success, { error: string } on failure
 */
export async function getConfig(): Promise<{ yaml: string } | { error: string }> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) {
      return { error: `Server returned ${res.status}: ${res.statusText}` };
    }
    const data = await res.json() as { yaml: string };
    return { yaml: data.yaml };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to fetch config' };
  }
}

/**
 * Save a YAML config string to the server.
 * @returns { ok: true } on success, { error: string } on failure
 */
export async function saveConfig(yamlText: string): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: yamlText }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { error: body.error ?? `Server returned ${res.status}: ${res.statusText}` };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Failed to save config' };
  }
}

/**
 * Fetch the minimal health check from the server.
 */
export async function getHealthz(): Promise<HealthzResponse> {
  const res = await fetch('/api/healthz');
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<HealthzResponse>;
}

/**
 * Fetch the full metrics snapshot from the server.
 */
export async function getMetrics(): Promise<HealthSnapshot> {
  const res = await fetch('/api/metrics');
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<HealthSnapshot>;
}
