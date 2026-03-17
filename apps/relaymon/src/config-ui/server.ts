/**
 * Config UI HTTP server
 *
 * Standalone Deno HTTP server that serves the config UI static assets
 * and provides a REST API for config management and stats proxying.
 *
 * Environment variables:
 *   CONFIG_UI_PORT          - Port to listen on (default: 3000)
 *   RELAYMON_CONFIG_PATH    - Path to the config YAML file (default: /opt/config.yaml)
 *   RELAYMON_HEALTH_URL     - Base URL of the relaymon health server (default: http://127.0.0.1:8080)
 *   CONFIG_UI_STATIC_DIR    - Directory to serve static files from (default: ./ui/dist relative to this file)
 */

import { parse as parseYaml } from "@std/yaml";
import { serveDir } from "@std/http/file-server";
import { join, dirname, fromFileUrl } from "@std/path";

// ============================================================
// Types
// ============================================================

export interface ServerConfig {
  port: number;
  configPath: string;
  healthUrl: string;
  staticDir: string;
}

// ============================================================
// CORS helpers
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

// ============================================================
// Route handlers
// ============================================================

async function handleGetConfig(configPath: string): Promise<Response> {
  try {
    const text = await Deno.readTextFile(configPath);
    return jsonResponse({ yaml: text });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return jsonResponse({ error: "Config not found" }, 404);
    }
    return jsonResponse({ error: "Failed to read config" }, 500);
  }
}

async function handlePutConfig(
  req: Request,
  configPath: string,
): Promise<Response> {
  let body: { yaml?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const yamlText = body.yaml;
  if (typeof yamlText !== "string") {
    return jsonResponse({ error: "Missing 'yaml' field in request body" }, 400);
  }

  // Validate YAML before touching disk
  try {
    parseYaml(yamlText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Invalid YAML: ${message}` }, 400);
  }

  // Atomic write: write to tmp file in same directory then rename
  const tmpPath = `${configPath}.tmp.${Date.now()}`;
  try {
    await Deno.writeTextFile(tmpPath, yamlText);
    await Deno.rename(tmpPath, configPath);
    return jsonResponse({ ok: true });
  } catch (err) {
    // Clean up tmp file if it exists
    try {
      await Deno.remove(tmpPath);
    } catch {
      // ignore cleanup errors
    }
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to write config: ${message}` }, 500);
  }
}

async function handleProxy(
  upstreamUrl: string,
  endpoint: string,
): Promise<Response> {
  try {
    const upstream = await fetch(`${upstreamUrl}${endpoint}`);
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        ...CORS_HEADERS,
      },
    });
  } catch {
    return jsonResponse(
      {
        status: "down",
        error: "Relaymon health server unreachable",
      },
      503,
    );
  }
}

// ============================================================
// Main handler factory
// ============================================================

export function createHandler(
  config: ServerConfig,
): (req: Request) => Promise<Response> {
  const { configPath, healthUrl, staticDir } = config;

  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const path = url.pathname;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // /api/config
    if (path === "/api/config") {
      if (method === "GET") {
        return handleGetConfig(configPath);
      }
      if (method === "PUT") {
        return handlePutConfig(req, configPath);
      }
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // /api/healthz proxy
    if (path === "/api/healthz") {
      return handleProxy(healthUrl, "/healthz");
    }

    // /api/metrics proxy
    if (path === "/api/metrics") {
      return handleProxy(healthUrl, "/metrics");
    }

    // Static file serving with SPA fallback
    try {
      const response = await serveDir(req, {
        fsRoot: staticDir,
        urlRoot: "",
        quiet: true,
      });

      // SPA fallback: if file not found and path has no extension, serve index.html
      if (response.status === 404 && !path.includes(".")) {
        try {
          const indexPath = join(staticDir, "index.html");
          const indexContent = await Deno.readTextFile(indexPath);
          return new Response(indexContent, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        } catch {
          // index.html not found either — return the original 404
          return response;
        }
      }

      return response;
    } catch {
      return new Response("Not found", { status: 404 });
    }
  };
}

// ============================================================
// Entry point (only runs when executed directly, not imported)
// ============================================================

if (import.meta.main) {
  const port = parseInt(Deno.env.get("CONFIG_UI_PORT") ?? "3000", 10);
  const configPath = Deno.env.get("RELAYMON_CONFIG_PATH") ?? "/opt/config.yaml";
  const healthUrl = Deno.env.get("RELAYMON_HEALTH_URL") ?? "http://127.0.0.1:8080";

  // Static dir: default is ../ui/dist relative to this file's location
  const scriptDir = dirname(fromFileUrl(import.meta.url));
  const staticDir = Deno.env.get("CONFIG_UI_STATIC_DIR") ?? join(scriptDir, "../ui/dist");

  const handler = createHandler({ port, configPath, healthUrl, staticDir });

  console.log(`Config UI server listening on http://0.0.0.0:${port}`);

  Deno.serve({ port, hostname: "0.0.0.0" }, handler);
}
