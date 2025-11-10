/**
 * Secret loading utilities with _FILE support
 *
 * Handles loading sensitive configuration from environment variables
 * with support for file-based secrets (for Docker/Kubernetes secrets).
 *
 * Precedence: _FILE → raw env → disabled
 */

import { getLogger } from "../utils/logger.ts";

const logger = getLogger("Secrets");

/**
 * Load a secret from environment variable or file
 *
 * @param envName - Environment variable name (e.g., "RELAYMON_KUMA_TOKEN")
 * @param fileEnvName - File path environment variable name (e.g., "RELAYMON_KUMA_TOKEN_FILE")
 * @returns Secret value or undefined if not found
 */
export async function loadSecret(
  envName: string,
  fileEnvName: string,
): Promise<string | undefined> {
  // Precedence 1: _FILE env var
  const filePath = Deno.env.get(fileEnvName);
  if (filePath) {
    try {
      const content = await Deno.readTextFile(filePath);
      const trimmed = content.trim();
      if (trimmed) {
        logger.info(`Loaded ${envName} from file: ${filePath}`);
        return trimmed;
      }
      logger.warn(`Secret file ${filePath} is empty for ${envName}`);
    } catch (error) {
      logger.error(
        `Failed to read secret file ${filePath} for ${envName}: ${error}`,
      );
      throw new Error(
        `Cannot read secret file ${filePath} for ${envName}: ${error}`,
      );
    }
  }

  // Precedence 2: Raw env var
  const rawValue = Deno.env.get(envName);
  if (rawValue) {
    logger.info(`Loaded ${envName} from environment variable`);
    return rawValue.trim();
  }

  // Not found
  return undefined;
}

/**
 * Load Uptime Kuma push URL
 *
 * Supports two patterns:
 * 1. RELAYMON_KUMA_PUSH_URL (full push URL with token)
 * 2. RELAYMON_KUMA_BASE_URL + RELAYMON_KUMA_TOKEN (composed URL)
 *
 * @returns Push URL or undefined if not configured
 */
export async function loadKumaPushUrl(): Promise<string | undefined> {
  // Pattern 1: Full push URL
  const pushUrl = await loadSecret(
    "RELAYMON_KUMA_PUSH_URL",
    "RELAYMON_KUMA_PUSH_URL_FILE",
  );
  if (pushUrl) {
    return pushUrl;
  }

  // Pattern 2: Base URL + Token
  const baseUrl = Deno.env.get("RELAYMON_KUMA_BASE_URL");
  const token = await loadSecret(
    "RELAYMON_KUMA_TOKEN",
    "RELAYMON_KUMA_TOKEN_FILE",
  );

  if (baseUrl && token) {
    // Ensure base URL doesn't end with slash
    const cleanBase = baseUrl.replace(/\/$/, "");
    const url = `${cleanBase}/api/push/${token}`;
    logger.info(
      "Composed Kuma push URL from RELAYMON_KUMA_BASE_URL + RELAYMON_KUMA_TOKEN",
    );
    return url;
  }

  if (baseUrl && !token) {
    logger.warn(
      "RELAYMON_KUMA_BASE_URL provided but RELAYMON_KUMA_TOKEN missing",
    );
  }

  return undefined;
}

/**
 * Load health server auth token
 *
 * @returns Auth token or undefined if not configured
 */
export async function loadHealthAuthToken(): Promise<string | undefined> {
  return await loadSecret(
    "RELAYMON_HEALTH_AUTH_TOKEN",
    "RELAYMON_HEALTH_AUTH_TOKEN_FILE",
  );
}

/**
 * Load signing private key (nsec)
 *
 * Supports RELAYMON_NSEC or RELAYMON_NSEC_FILE
 *
 * @returns Private key (nsec or hex) or undefined if not configured
 */
export async function loadNsec(): Promise<string | undefined> {
  return await loadSecret("RELAYMON_NSEC", "RELAYMON_NSEC_FILE");
}

/**
 * Redact sensitive value for logging
 *
 * Shows first 4 and last 4 characters, redacts the middle
 *
 * @param value - Sensitive value to redact
 * @param showChars - Number of characters to show at start/end (default: 4)
 * @returns Redacted string
 */
export function redactSecret(value: string | undefined, showChars = 4): string {
  if (!value) {
    return "(not set)";
  }

  if (value.length <= showChars * 2) {
    return "***";
  }

  const start = value.slice(0, showChars);
  const end = value.slice(-showChars);
  const redactedLength = value.length - (showChars * 2);

  return `${start}${"*".repeat(Math.min(redactedLength, 10))}${end}`;
}

/**
 * Redact URL with token/password
 *
 * Replaces sensitive parts of URLs while keeping structure visible
 *
 * @param url - URL potentially containing secrets
 * @returns Redacted URL
 */
export function redactUrl(url: string | undefined): string {
  if (!url) {
    return "(not set)";
  }

  try {
    const parsed = new URL(url);

    // Redact password in auth
    if (parsed.password) {
      parsed.password = "***";
    }

    // Redact path segments that look like tokens (long alphanumeric strings)
    const pathParts = parsed.pathname.split("/");
    const redactedPath = pathParts.map((part) => {
      // If part is longer than 20 chars and alphanumeric, likely a token
      if (part.length > 20 && /^[a-zA-Z0-9_-]+$/.test(part)) {
        return redactSecret(part, 4);
      }
      return part;
    }).join("/");

    parsed.pathname = redactedPath;

    return parsed.toString();
  } catch {
    // If URL parsing fails, do basic redaction
    return url.replace(
      /[a-f0-9]{32,}|[A-Za-z0-9_-]{32,}/g,
      (match) => redactSecret(match, 4),
    );
  }
}

/**
 * Validate that a secret is present
 *
 * @param value - Secret value to validate
 * @param name - Human-readable name for error messages
 * @throws Error if secret is missing or empty
 */
export function requireSecret(
  value: string | undefined,
  name: string,
): asserts value is string {
  if (!value || value.trim() === "") {
    throw new Error(`Required secret ${name} is not configured`);
  }
}

/**
 * Load all secrets and return status
 *
 * @returns Secret loading status with redacted values for logging
 */
export async function loadAllSecrets(): Promise<{
  kumaPushUrl?: string;
  healthAuthToken?: string;
  nsec?: string;
  status: {
    kuma: string;
    healthAuth: string;
    nsec: string;
  };
}> {
  const kumaPushUrl = await loadKumaPushUrl();
  const healthAuthToken = await loadHealthAuthToken();
  const nsec = await loadNsec();

  return {
    kumaPushUrl,
    healthAuthToken,
    nsec,
    status: {
      kuma: redactUrl(kumaPushUrl),
      healthAuth: redactSecret(healthAuthToken),
      nsec: redactSecret(nsec),
    },
  };
}
