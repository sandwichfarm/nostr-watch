/**
 * Config Type Validation Tests
 *
 * Tests for strict Config type definitions and runtime validation.
 * Following Test-Driven Development: tests written BEFORE implementation.
 */

import {
  assertEquals,
  assertExists,
  assertThrows,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import { mockConfig } from "../helpers/fixtures.ts";

// Import types that we're about to create
import type {
  Config,
  MonitorConfig,
  RelaymonConfig,
} from "../../src/types/config.ts";
import { validateConfig } from "../../src/types/config.ts";

Deno.test("Config validation - valid config passes", () => {
  const validConfig: Config = {
    monitor: {
      slug: "test",
      info: {
        name: "Test Monitor",
        about: "Test monitor",
      },
      owner: "test-pubkey",
    },
    publisher: {
      relays: ["wss://relay.test.com"],
    },
    relaymon: {
      networks: ["clearnet"],
      retry: {
        expiry: [
          { max: 3, delay: 60000 },
        ],
      },
      seed: {
        interval: 60000,
        sources: ["cache"],
        options: {
          db: {
            path: "./test.db",
            enableWAL: true,
          },
        },
      },
      checks: {
        enabled: ["open", "read"],
        options: {
          expires: 86400000,
          interval: 15000,
          timeout: {
            open: 30000,
            read: 5000,
          },
          max: 200,
          statusInterval: 20,
        },
      },
    },
  };

  const result = validateConfig(validConfig);
  assertExists(result);
  assertEquals(result.monitor.slug, "test");
  assertEquals(result.relaymon.networks[0], "clearnet");
});

Deno.test("Config validation - mockConfig from fixtures passes", () => {
  const result = validateConfig(mockConfig);
  assertExists(result);
  assertEquals(result.monitor.slug, "test-monitor");
});

Deno.test("Config validation - missing monitor.slug throws", () => {
  const invalidConfig = {
    monitor: {
      info: { name: "Test", about: "Test" },
      owner: "pubkey",
    },
    publisher: { relays: [] },
    relaymon: {} as any,
  };

  assertThrows(
    () => validateConfig(invalidConfig as any),
    Error,
    "monitor.slug",
  );
});

Deno.test("Config validation - missing monitor.info.name throws", () => {
  const invalidConfig = {
    monitor: {
      slug: "test",
      info: { about: "Test" },
      owner: "pubkey",
    },
    publisher: { relays: [] },
    relaymon: {} as any,
  };

  assertThrows(
    () => validateConfig(invalidConfig as any),
    Error,
    "monitor.info.name",
  );
});

Deno.test("Config validation - missing relaymon.networks throws", () => {
  const invalidConfig = {
    monitor: {
      slug: "test",
      info: { name: "Test", about: "Test" },
      owner: "pubkey",
    },
    publisher: { relays: [] },
    relaymon: {
      retry: { expiry: [] },
      seed: { interval: 1000, sources: [], options: {} },
      checks: { enabled: [], options: {} as any },
    },
  };

  assertThrows(
    () => validateConfig(invalidConfig as any),
    Error,
    "relaymon.networks",
  );
});

Deno.test("Config validation - empty relaymon.networks throws", () => {
  const invalidConfig = {
    monitor: {
      slug: "test",
      info: { name: "Test", about: "Test" },
      owner: "pubkey",
    },
    publisher: { relays: [] },
    relaymon: {
      networks: [],
      retry: { expiry: [] },
      seed: { interval: 1000, sources: [], options: {} },
      checks: { enabled: [], options: {} as any },
    },
  };

  assertThrows(
    () => validateConfig(invalidConfig as any),
    Error,
    "networks",
  );
});

Deno.test("Config validation - invalid network type throws", () => {
  const invalidConfig = {
    monitor: {
      slug: "test",
      info: { name: "Test", about: "Test" },
      owner: "pubkey",
    },
    publisher: { relays: [] },
    relaymon: {
      networks: ["invalid-network"],
      retry: { expiry: [] },
      seed: { interval: 1000, sources: [], options: {} },
      checks: { enabled: [], options: {} as any },
    },
  };

  assertThrows(
    () => validateConfig(invalidConfig as any),
    Error,
    "Invalid network type",
  );
});

Deno.test("Config validation - optional fields handled correctly", () => {
  const configWithOptionals: Config = {
    monitor: {
      slug: "test",
      info: {
        name: "Test",
        about: "Test",
        nip05: "test@example.com", // optional
      },
      owner: "pubkey",
      geo: { // optional
        city: "Test City",
        country: "Test Country",
        countryCode: "TC",
        lat: 0,
        lon: 0,
        region: "Test Region",
        continent: "Test Continent",
      },
    },
    publisher: {
      relays: ["wss://relay.test.com"],
    },
    relaymon: {
      networks: ["clearnet"],
      retry: {
        expiry: [{ max: 3, delay: 60000 }],
      },
      seed: {
        interval: 60000,
        sources: ["cache"],
        options: {},
      },
      checks: {
        enabled: ["open"],
        options: {
          expires: 86400000,
          interval: 15000,
          timeout: {
            open: 30000,
          },
          max: 200,
          statusInterval: 20,
        },
      },
      ignorelist: { // optional
        enabled: true,
        interval: "6h",
        deletion_interval: "24h",
        relays: [],
        pubkeys: [],
      },
      deduplication: { // optional
        reevaluation_interval: "24h",
        nip11_cache_ttl: "24h",
      },
    },
    queue: { // optional
      workerConcurrency: 5,
    },
    logLevel: "info", // optional
  };

  const result = validateConfig(configWithOptionals);
  assertExists(result);
  assertEquals(result.monitor.info.nip05, "test@example.com");
  assertEquals(result.monitor.geo?.city, "Test City");
  assertEquals(result.relaymon.ignorelist?.enabled, true);
  assertEquals(result.queue?.workerConcurrency, 5);
  assertEquals(result.logLevel, "info");
});

Deno.test("Config validation - trustedRelayAssertions defaults are applied", () => {
  const configWithTra = {
    ...mockConfig,
    relaymon: {
      ...mockConfig.relaymon,
      trustedRelayAssertions: {
        enabled: true,
      },
    },
  };

  const result = validateConfig(configWithTra);

  assertEquals(result.relaymon.trustedRelayAssertions?.enabled, true);
  assertEquals(result.relaymon.trustedRelayAssertions?.relays, []);
  assertEquals(result.relaymon.trustedRelayAssertions?.min_observations, 10);
  assertEquals(
    result.relaymon.trustedRelayAssertions?.material_change_threshold,
    3,
  );
  assertEquals(result.relaymon.trustedRelayAssertions?.refresh_interval, "1h");
  assertEquals(
    result.relaymon.trustedRelayAssertions?.history_retention,
    "30d",
  );
  assertEquals(
    result.relaymon.trustedRelayAssertions?.max_observations_per_relay,
    1000,
  );
  assertEquals(
    result.relaymon.trustedRelayAssertions?.publish_unreachable,
    true,
  );
  assertEquals(result.relaymon.trustedRelayAssertions?.publish_blocked, false);
  assertEquals(
    result.relaymon.trustedRelayAssertions?.algorithm?.version,
    "relaymon-local-v2",
  );
});

Deno.test("Config validation - trustedRelayAssertions validates relay list", () => {
  const invalidConfig = {
    ...mockConfig,
    relaymon: {
      ...mockConfig.relaymon,
      trustedRelayAssertions: {
        enabled: true,
        relays: ["wss://relay.example.com", 123],
      },
    },
  };

  assertThrows(
    () => validateConfig(invalidConfig as any),
    Error,
    "trustedRelayAssertions.relays",
  );
});

Deno.test("Config validation - all network types accepted", () => {
  const networks = ["clearnet", "tor", "i2p", "lokinet"];

  for (const network of networks) {
    const config = {
      monitor: {
        slug: "test",
        info: { name: "Test", about: "Test" },
        owner: "pubkey",
      },
      publisher: { relays: [] },
      relaymon: {
        networks: [network],
        retry: { expiry: [] },
        seed: { interval: 1000, sources: [], options: {} },
        checks: { enabled: [], options: {} as any },
      },
    };

    const result = validateConfig(config as any);
    assertExists(result);
    assertEquals(result.relaymon.networks[0], network);
  }
});

Deno.test("Config validation - null config throws", () => {
  assertThrows(
    () => validateConfig(null as any),
    Error,
    "Config must be an object",
  );
});

Deno.test("Config validation - undefined config throws", () => {
  assertThrows(
    () => validateConfig(undefined as any),
    Error,
    "Config must be an object",
  );
});

Deno.test("Config validation - non-object config throws", () => {
  assertThrows(
    () => validateConfig("not an object" as any),
    Error,
    "Config must be an object",
  );
});

Deno.test("Config validation - array config throws", () => {
  assertThrows(
    () => validateConfig([] as any),
    Error,
    "Config must be an object",
  );
});
