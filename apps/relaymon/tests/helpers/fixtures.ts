/**
 * Test Fixtures for RelayMon
 *
 * Shared test data and fixtures used across unit and integration tests.
 */

export const mockConfig = {
  monitor: {
    slug: "test-monitor",
    info: {
      name: "Test Monitor",
      about: "Monitor for testing purposes",
      nip05: "test@example.com"
    },
    owner: "test-pubkey-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    geo: {
      city: "Test City",
      country: "Test Country",
      countryCode: "TC",
      lat: 0,
      lon: 0,
      region: "Test Region",
      continent: "Test Continent"
    }
  },
  publisher: {
    relays: [
      "wss://relay.test1.com",
      "wss://relay.test2.com"
    ]
  },
  relaymon: {
    networks: ["clearnet"],
    retry: {
      expiry: [
        { max: 3, delay: 60000 },      // 1m
        { max: 5, delay: 1200000 },    // 20m
        { max: 7, delay: 3600000 }     // 1h
      ]
    },
    seed: {
      interval: 60000, // 1m
      sources: ["config", "cache"],
      options: {
        db: {
          path: ":memory:",
          enableWAL: false
        },
        config: ["wss://relay.example.com"]
      }
    },
    checks: {
      enabled: ["open", "read", "info"],
      options: {
        expires: 86400000, // 24h
        interval: 15000,   // 15s
        timeout: {
          open: 30000,
          read: 5000,
          info: 10000
        },
        max: 200,
        statusInterval: 20
      }
    },
    ignorelist: {
      enabled: false,
      interval: "6h",
      deletion_interval: "24h",
      relays: [],
      pubkeys: []
    },
    deduplication: {
      reevaluation_interval: "24h",
      nip11_cache_ttl: "24h"
    }
  },
  queue: {
    workerConcurrency: 5
  },
  logLevel: "error" // Quiet during tests
};

export const mockRelayResult = {
  url: "wss://relay.example.com",
  hostname: "relay.example.com",
  protocol: "wss:",
  checked_at: Date.now(),
  online: true,
  ignore: false,
  parent: "",
  network: "clearnet" as const,
  open: {
    data: true,
    duration: 100
  },
  read: {
    data: true,
    duration: 50
  },
  info: {
    data: {
      name: "Test Relay",
      description: "A relay for testing",
      pubkey: "test-relay-pubkey",
      contact: "test@example.com",
      supported_nips: [1, 2, 11],
      software: "test-relay-software",
      version: "1.0.0"
    },
    duration: 75
  }
};

export const mockRelayResultOffline = {
  ...mockRelayResult,
  url: "wss://offline.example.com",
  hostname: "offline.example.com",
  online: false,
  open: {
    data: false,
    duration: 3000,
    error: new Error("Connection timeout")
  }
};

export const mockRelayResultWithPath = {
  ...mockRelayResult,
  url: "wss://relay.example.com/path",
  parent: "wss://relay.example.com"
};

export const mockRelayResultDifferentNIP11 = {
  ...mockRelayResult,
  url: "wss://relay.example.com/different",
  info: {
    data: {
      name: "Different Relay",
      description: "A different relay on same host",
      pubkey: "different-relay-pubkey",
      contact: "different@example.com",
      supported_nips: [1, 11, 50],
      software: "different-software",
      version: "2.0.0"
    },
    duration: 80
  }
};

export const mockRelayResultNoNIP11 = {
  ...mockRelayResult,
  url: "wss://no-nip11.example.com",
  hostname: "no-nip11.example.com",
  info: undefined
};

// Mock database rows
export const mockRelayStatusRow = {
  url: "wss://relay.example.com",
  online: 1,
  ignore: 0,
  parent: null,
  checked_at: Date.now(),
  rtt: 100,
  network: "clearnet",
  retries: 0
};

export const mockRelayInfoRow = {
  url: "wss://relay.example.com",
  info_hash: "RelayCheckInfo@abc123",
  info_data: JSON.stringify(mockRelayResult.info?.data),
  updated_at: Date.now()
};

// Mock event data
export const mockKind30166Event = {
  kind: 30166,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ["d", "wss://relay.example.com"],
    ["u", "wss://relay.example.com"],
    ["rtt", "open", "100", "pass"],
    ["rtt", "read", "50", "pass"],
    ["n", "clearnet"]
  ],
  content: JSON.stringify({ checks: ["open", "read", "info"] }),
  pubkey: "test-monitor-pubkey",
  id: "event-id-123",
  sig: "event-signature-456"
};

export const mockKind10006Event = {
  kind: 10006,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ["r", "wss://ignored1.example.com"],
    ["r", "wss://ignored2.example.com"]
  ],
  content: "",
  pubkey: "test-monitor-pubkey",
  id: "event-id-789",
  sig: "event-signature-012"
};

// Helper functions for creating test data
export function createMockRelayResult(overrides: Partial<typeof mockRelayResult> = {}) {
  return {
    ...mockRelayResult,
    ...overrides,
    checked_at: Date.now() // Always use current timestamp
  };
}

export function createMockConfig(overrides: Partial<typeof mockConfig> = {}) {
  return {
    ...mockConfig,
    ...overrides
  };
}

export function createMockRelayStatusRow(overrides: Partial<typeof mockRelayStatusRow> = {}) {
  return {
    ...mockRelayStatusRow,
    ...overrides,
    checked_at: Date.now()
  };
}
