/**
 * Unit tests for config-ui server
 *
 * Tests handler functions in isolation without starting a real server.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { createHandler, type ServerConfig } from "../../src/config-ui/server.ts";

// Helper to make a request to the handler
async function request(
  handler: (req: Request) => Promise<Response>,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return handler(new Request(`http://localhost${path}`, options));
}

// Create a temp dir for testing config files
async function makeTempDir(): Promise<string> {
  return await Deno.makeTempDir({ prefix: "config-ui-test-" });
}

// ============================================================
// Test: Atomic write function
// ============================================================

Deno.test("atomic write: creates file with correct content", async () => {
  const tmpDir = await makeTempDir();
  const configPath = `${tmpDir}/config.yaml`;
  const yamlContent = "monitor:\n  slug: test\n";

  const config: ServerConfig = {
    configPath,
    healthUrl: "http://127.0.0.1:8080",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml: yamlContent }),
  });

  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.ok, true);

  // Verify file content
  const written = await Deno.readTextFile(configPath);
  assertEquals(written, yamlContent);

  // Verify no .tmp file remains
  let tmpExists = false;
  for await (const entry of Deno.readDir(tmpDir)) {
    if (entry.name.includes(".tmp.")) {
      tmpExists = true;
    }
  }
  assertEquals(tmpExists, false, "No .tmp file should remain after successful write");

  await Deno.remove(tmpDir, { recursive: true });
});

// ============================================================
// Test: YAML validation
// ============================================================

Deno.test("YAML validation: valid YAML passes and returns ok:true", async () => {
  const tmpDir = await makeTempDir();
  const configPath = `${tmpDir}/config.yaml`;

  const config: ServerConfig = {
    configPath,
    healthUrl: "http://127.0.0.1:8080",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml: "key: value\nlist:\n  - item1\n  - item2\n" }),
  });

  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.ok, true);

  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("YAML validation: invalid YAML returns 400 and does not write to disk", async () => {
  const tmpDir = await makeTempDir();
  const configPath = `${tmpDir}/config.yaml`;

  const config: ServerConfig = {
    configPath,
    healthUrl: "http://127.0.0.1:8080",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yaml: "invalid: yaml: {{{badly: [malformed" }),
  });

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(typeof body.error, "string", "Should have error message");

  // Verify config file was NOT written
  let fileExists = true;
  try {
    await Deno.stat(configPath);
  } catch {
    fileExists = false;
  }
  assertEquals(fileExists, false, "Config file should not be created on invalid YAML");

  await Deno.remove(tmpDir, { recursive: true });
});

// ============================================================
// Test: Config read
// ============================================================

Deno.test("GET /api/config: returns 200 with yaml content when file exists", async () => {
  const tmpDir = await makeTempDir();
  const configPath = `${tmpDir}/config.yaml`;
  const yamlContent = "monitor:\n  slug: my-relay\n  # important comment\n";
  await Deno.writeTextFile(configPath, yamlContent);

  const config: ServerConfig = {
    configPath,
    healthUrl: "http://127.0.0.1:8080",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/config");
  assertEquals(resp.status, 200);
  const body = await resp.json();

  // Should return raw YAML text (not re-serialized), preserving comments
  assertEquals(body.yaml, yamlContent);

  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("GET /api/config: returns 404 when config file does not exist", async () => {
  const tmpDir = await makeTempDir();
  const configPath = `${tmpDir}/nonexistent.yaml`;

  const config: ServerConfig = {
    configPath,
    healthUrl: "http://127.0.0.1:8080",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/config");
  assertEquals(resp.status, 404);
  const body = await resp.json();
  assertEquals(body.error, "Config not found");

  await Deno.remove(tmpDir, { recursive: true });
});

// ============================================================
// Test: CORS headers
// ============================================================

Deno.test("OPTIONS request returns CORS headers", async () => {
  const tmpDir = await makeTempDir();

  const config: ServerConfig = {
    configPath: `${tmpDir}/config.yaml`,
    healthUrl: "http://127.0.0.1:8080",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/config", { method: "OPTIONS" });
  assertEquals(resp.status, 204);
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    resp.headers.get("Access-Control-Allow-Methods"),
    "GET, PUT, POST, OPTIONS",
  );

  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("JSON responses include CORS allow-origin header", async () => {
  const tmpDir = await makeTempDir();
  const configPath = `${tmpDir}/config.yaml`;
  await Deno.writeTextFile(configPath, "key: value\n");

  const config: ServerConfig = {
    configPath,
    healthUrl: "http://127.0.0.1:8080",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/config");
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");

  await Deno.remove(tmpDir, { recursive: true });
});

// ============================================================
// Test: Health proxy endpoints (503 when upstream unreachable)
// ============================================================

Deno.test("GET /api/healthz returns 503 when upstream is unreachable", async () => {
  const tmpDir = await makeTempDir();

  const config: ServerConfig = {
    configPath: `${tmpDir}/config.yaml`,
    // Use port that nothing should be listening on
    healthUrl: "http://127.0.0.1:19999",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/healthz");
  assertEquals(resp.status, 503);
  const body = await resp.json();
  assertEquals(body.status, "down");
  assertEquals(typeof body.error, "string");

  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("GET /api/metrics returns 503 when upstream is unreachable", async () => {
  const tmpDir = await makeTempDir();

  const config: ServerConfig = {
    configPath: `${tmpDir}/config.yaml`,
    healthUrl: "http://127.0.0.1:19999",
    staticDir: tmpDir,
    port: 3000,
  };
  const handler = createHandler(config);

  const resp = await request(handler, "/api/metrics");
  assertEquals(resp.status, 503);
  const body = await resp.json();
  assertEquals(body.status, "down");

  await Deno.remove(tmpDir, { recursive: true });
});
