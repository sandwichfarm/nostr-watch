/**
 * Relay Type Validation Tests
 *
 * Tests for RelayCheckResult type definitions and type guards.
 * Following Test-Driven Development: tests written to validate implementation.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  isNocapCheckResult,
  isRelayCheckResult,
  isRelayOnline,
  getTotalDuration,
  type NocapCheckResult,
  type RelayCheckResult
} from "../../src/types/relay.ts";

Deno.test("isNocapCheckResult - valid minimal result passes", () => {
  const result = {
    url: "wss://relay.example.com"
  };

  assert(isNocapCheckResult(result));
});

Deno.test("isNocapCheckResult - valid result with checks passes", () => {
  const result = {
    url: "wss://relay.example.com",
    open: {
      data: true,
      duration: 100
    },
    read: {
      data: true,
      duration: 50
    }
  };

  assert(isNocapCheckResult(result));
});

Deno.test("isNocapCheckResult - missing url fails", () => {
  const result = {
    open: { data: true, duration: 100 }
  };

  assert(!isNocapCheckResult(result));
});

Deno.test("isNocapCheckResult - empty url fails", () => {
  const result = {
    url: ""
  };

  assert(!isNocapCheckResult(result));
});

Deno.test("isNocapCheckResult - null/undefined fails", () => {
  assert(!isNocapCheckResult(null));
  assert(!isNocapCheckResult(undefined));
  assert(!isNocapCheckResult("not an object"));
  assert(!isNocapCheckResult(123));
  assert(!isNocapCheckResult([]));
});

Deno.test("isNocapCheckResult - check without data fails", () => {
  const result = {
    url: "wss://relay.example.com",
    open: {
      duration: 100
      // Missing data field
    }
  };

  assert(!isNocapCheckResult(result));
});

Deno.test("isNocapCheckResult - check without duration fails", () => {
  const result = {
    url: "wss://relay.example.com",
    open: {
      data: true
      // Missing duration field
    }
  };

  assert(!isNocapCheckResult(result));
});

Deno.test("isNocapCheckResult - check with error is valid", () => {
  const result = {
    url: "wss://relay.example.com",
    open: {
      data: false,
      duration: 3000,
      error: new Error("Connection timeout")
    }
  };

  assert(isNocapCheckResult(result));
});

Deno.test("isRelayCheckResult - valid fully-processed result passes", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: "",
    network: "clearnet",
    open: {
      data: true,
      duration: 100
    }
  };

  assert(isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - missing hostname fails", () => {
  const result = {
    url: "wss://relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: "",
    network: "clearnet"
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - missing protocol fails", () => {
  const result = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: "",
    network: "clearnet"
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - missing checked_at fails", () => {
  const result = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    online: true,
    ignore: false,
    parent: "",
    network: "clearnet"
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - missing online fails", () => {
  const result = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    ignore: false,
    parent: "",
    network: "clearnet"
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - missing ignore fails", () => {
  const result = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    parent: "",
    network: "clearnet"
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - missing parent fails", () => {
  const result = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    network: "clearnet"
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - missing network fails", () => {
  const result = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: ""
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - invalid network type fails", () => {
  const result = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: "",
    network: "invalid-network"
  };

  assert(!isRelayCheckResult(result));
});

Deno.test("isRelayCheckResult - all valid network types pass", () => {
  const networks = ["clearnet", "tor", "i2p", "lokinet"];

  for (const network of networks) {
    const result = {
      url: "wss://relay.example.com",
      hostname: "relay.example.com",
      protocol: "wss:",
      checked_at: Date.now(),
      online: true,
      ignore: false,
      parent: "",
      network
    };

    assert(isRelayCheckResult(result), `Network type ${network} should be valid`);
  }
});

Deno.test("isRelayOnline - returns true for online relay (via online field)", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: "",
    network: "clearnet"
  };

  assert(isRelayOnline(result));
});

Deno.test("isRelayOnline - returns false for offline relay (via online field)", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: false,
    ignore: false,
    parent: "",
    network: "clearnet"
  };

  assert(!isRelayOnline(result));
});

Deno.test("isRelayOnline - returns true for online relay (via open.data)", () => {
  const result: NocapCheckResult = {
    url: "wss://relay.example.com",
    open: {
      data: true,
      duration: 100
    }
  };

  assert(isRelayOnline(result));
});

Deno.test("isRelayOnline - returns false for offline relay (via open.data)", () => {
  const result: NocapCheckResult = {
    url: "wss://relay.example.com",
    open: {
      data: false,
      duration: 3000
    }
  };

  assert(!isRelayOnline(result));
});

Deno.test("isRelayOnline - returns false when open check missing", () => {
  const result: NocapCheckResult = {
    url: "wss://relay.example.com"
  };

  assert(!isRelayOnline(result));
});

Deno.test("getTotalDuration - calculates correct total", () => {
  const result: NocapCheckResult = {
    url: "wss://relay.example.com",
    open: { data: true, duration: 100 },
    read: { data: true, duration: 50 },
    write: { data: true, duration: 75 },
    info: { data: {}, duration: 60 }
  };

  const total = getTotalDuration(result);
  assertEquals(total, 285);
});

Deno.test("getTotalDuration - handles missing checks", () => {
  const result: NocapCheckResult = {
    url: "wss://relay.example.com",
    open: { data: true, duration: 100 }
  };

  const total = getTotalDuration(result);
  assertEquals(total, 100);
});

Deno.test("getTotalDuration - returns 0 for no checks", () => {
  const result: NocapCheckResult = {
    url: "wss://relay.example.com"
  };

  const total = getTotalDuration(result);
  assertEquals(total, 0);
});

Deno.test("getTotalDuration - includes all check types", () => {
  const result: NocapCheckResult = {
    url: "wss://relay.example.com",
    open: { data: true, duration: 100 },
    read: { data: true, duration: 50 },
    write: { data: true, duration: 75 },
    info: { data: {}, duration: 60 },
    dns: { data: {}, duration: 20 },
    geo: { data: {}, duration: 30 },
    ssl: { data: {}, duration: 40 }
  };

  const total = getTotalDuration(result);
  assertEquals(total, 375);
});

Deno.test("RelayCheckResult - valid result with NIP-11 info", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: "",
    network: "clearnet",
    open: { data: true, duration: 100 },
    info: {
      data: {
        name: "Test Relay",
        description: "A test relay",
        pubkey: "test-pubkey",
        supported_nips: [1, 2, 11],
        software: "test-software",
        version: "1.0.0"
      },
      duration: 60
    }
  };

  assert(isRelayCheckResult(result));
  assertExists(result.info);
  assertEquals(result.info.data.name, "Test Relay");
});

Deno.test("RelayCheckResult - valid result with parent (path-based)", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com/path",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: false,
    parent: "wss://relay.example.com",
    network: "clearnet"
  };

  assert(isRelayCheckResult(result));
  assertEquals(result.parent, "wss://relay.example.com");
});

Deno.test("RelayCheckResult - valid result marked as ignored", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    checked_at: Date.now(),
    online: true,
    ignore: true,
    parent: "",
    network: "clearnet"
  };

  assert(isRelayCheckResult(result));
  assert(result.ignore);
});
