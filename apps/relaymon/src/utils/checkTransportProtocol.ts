import { isNocapCheckResult, type NocapCheckResult } from "../types/relay.ts";
import { parseRelayNetwork } from "@nostrwatch/utils";
import type { CheckTimeoutConfig } from "../types/config.ts";
import { ConfigDefaults } from "../../../../libraries/nocap/src/validators/ConfigValidator.ts";

export const CHECK_PROTOCOL = 1;
export type CheckProfile = "default" | "info-only";
export interface CheckRequest {
  url: string;
  checks: string[];
  options: {
    logLevel?: string;
    timeouts?: CheckTimeoutConfig;
    timeout?: number | CheckTimeoutConfig;
  };
  profile: CheckProfile;
}
export interface CheckFrame {
  v: number;
  generation: string;
  request: string;
  url: string;
  type: "ready" | "check" | "accepted" | "result" | "error";
  input?: CheckRequest;
  deadlineMs?: number;
  deadlineReason?: string;
  orderedChecks?: string[];
  result?: NocapCheckResult;
}

export function checkRequest(input: CheckRequest): void {
  const url = new URL(input.url);
  if (
    !["ws:", "wss:"].includes(url.protocol) || url.username || url.password ||
    !["default", "info-only"].includes(input.profile) ||
    !Array.isArray(input.checks) ||
    !input.checks.length ||
    new Set(input.checks).size !== input.checks.length ||
    input.checks.some((x) => !["open", "read", "info"].includes(x))
  ) {
    throw new Error("Unsupported isolated network check");
  }
  if (
    input.profile === "info-only" &&
    (input.checks.length !== 1 || input.checks[0] !== "info")
  ) throw new Error("Invalid info-only profile");
  if (
    Object.keys(input.options).some((x) =>
      !["logLevel", "timeouts", "timeout"].includes(x)
    )
  ) {
    throw new Error("Unsupported isolated NoCap option");
  }
  for (const key of ["timeout", "timeouts"] as const) {
    const value = input.options[key];
    if (
      value !== undefined &&
      !(typeof value === "number"
        ? Number.isFinite(value) && value > 0
        : value && typeof value === "object" &&
          Object.entries(value).every(([k, v]) =>
            ["open", "read", "write", "info", "dns", "geo", "ssl"].includes(
              k,
            ) && Number.isFinite(v) && v > 0
          ))
    ) {
      throw new Error("Invalid isolated timeout options");
    }
  }
}

/** Keep every JSON result field, while rejecting non-finite/cyclic/deep payloads. */
export function checkDeadline(
  input: CheckRequest,
): { ms: number; reason: string; orderedChecks: string[] } {
  checkRequest(input);
  const orderedChecks = [...new Set(["open", ...input.checks])].sort((a, b) =>
    ["open", "read", "info"].indexOf(a) - ["open", "read", "info"].indexOf(b)
  );
  const numeric = typeof input.options.timeout === "number";
  const timeouts = input.options.timeout ?? ConfigDefaults.timeout;
  const ms = numeric
    ? input.options.timeout as number
    : orderedChecks.reduce((sum, key) => {
      const value = (timeouts as Record<string, number>)[key];
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error("No finite SDK timeout for requested check");
      }
      return sum + value;
    }, 0);
  if (!Number.isSafeInteger(ms) || ms <= 0 || ms > 2147483647) {
    throw new Error("Invalid check IPC deadline");
  }
  return {
    ms,
    orderedChecks,
    reason: numeric
      ? "caller-declared numeric timeout; SDK timer absent"
      : "effective SDK timeout sum",
  };
}

export function validateCheckResult(
  input: CheckRequest,
  result: unknown,
): asserts result is NocapCheckResult {
  const url = new URL(input.url);
  if (!isNocapCheckResult(result)) throw new Error("Malformed check result");
  const raw = result as unknown as Record<string, unknown>;
  if (
    raw.url !== url.toString() || raw.hostname !== url.hostname ||
    raw.protocol !== url.protocol ||
    raw.network !== parseRelayNetwork(url.toString()) ||
    typeof raw.ignore !== "boolean" ||
    !(raw.parent === null || typeof raw.parent === "string") ||
    !Array.isArray(raw.adapters) ||
    raw.adapters.some((x) => typeof x !== "string") ||
    typeof raw.checked_by !== "string" ||
    typeof raw.checked_at !== "number" || !Number.isFinite(raw.checked_at)
  ) throw new Error("Malformed check result headers");
  for (const key of input.checks) {
    const value = raw[key] as Record<string, unknown> | undefined;
    if (
      !value || typeof value !== "object" || value.data === undefined ||
      typeof value.duration !== "number" ||
      !Number.isFinite(value.duration) ||
      (value.message !== undefined && typeof value.message !== "string") ||
      (value.status !== undefined && typeof value.status !== "string")
    ) throw new Error("Missing requested check result");
  }
  finiteJson(result);
}

export function finiteJson(
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
): void {
  if (depth > 32) throw new Error("Check result nesting limit");
  if (
    value === null || typeof value === "string" || typeof value === "boolean" ||
    value === undefined
  ) return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || seen.has(value)) {
    throw new Error("Non-JSON check result");
  }
  if (
    !Array.isArray(value) &&
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) throw new Error("Non-JSON check result object");
  seen.add(value);
  for (const child of Object.values(value)) finiteJson(child, depth + 1, seen);
  seen.delete(value);
}

export function encodeCheckFrame(
  frame: CheckFrame,
  maxBytes: number,
): Uint8Array {
  finiteJson(frame);
  const bytes = new TextEncoder().encode(JSON.stringify(frame) + "\n");
  if (bytes.length > maxBytes) {
    throw new Error("Check frame exceeds byte limit");
  }
  return bytes;
}

export async function readCheckFrames(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  onFrame: (frame: CheckFrame) => void | Promise<void>,
): Promise<void> {
  const reader = stream.getReader();
  let pending = new Uint8Array(0);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      let start = 0;
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== 10) continue;
        const segment = value.subarray(start, i);
        if (pending.length + segment.length + 1 > maxBytes) {
          throw new Error("Oversized check frame");
        }
        const line = new Uint8Array(pending.length + segment.length);
        line.set(pending);
        line.set(segment, pending.length);
        pending = new Uint8Array(0);
        const frame = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(line),
        );
        finiteJson(frame);
        await onFrame(frame);
        start = i + 1;
      }
      const rest = value.subarray(start);
      if (pending.length + rest.length + 1 > maxBytes) {
        throw new Error("Oversized check frame");
      }
      const next = new Uint8Array(pending.length + rest.length);
      next.set(pending);
      next.set(rest, pending.length);
      pending = next;
    }
    if (pending.length) throw new Error("Truncated check frame");
  } finally {
    reader.releaseLock();
  }
}
