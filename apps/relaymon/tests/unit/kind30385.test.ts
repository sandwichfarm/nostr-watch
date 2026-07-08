import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import { hexToBytes } from "@noble/hashes/utils";
import { getPublicKey, verifyEvent } from "npm:nostr-tools";
import type { TrustedRelayAssertionsConfig } from "../../src/types/config.ts";
import type { RelayCheckResult } from "../../src/types/relay.ts";
import {
  buildTrustedRelayAssertion,
  hasTrustedRelayMaterialChange,
  Kind30385,
  normalizeRelayUrl,
} from "../../src/tra/kind30385.ts";
import type { TrustedRelayObservationState } from "../../src/db/db.ts";

function traTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn,
  });
}

const TEST_PRIVKEY =
  "0000000000000000000000000000000000000000000000000000000000000001";
const TEST_PUBKEY = getPublicKey(hexToBytes(TEST_PRIVKEY));
const RELAY_PUBKEY =
  "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

const config: TrustedRelayAssertionsConfig = {
  enabled: true,
  min_observations: 2,
  material_change_threshold: 3,
  refresh_interval: 3600000,
  publish_unreachable: true,
  publish_blocked: false,
  algorithm: {
    version: "relaymon-local-test",
    url: "https://github.com/Letdown2491/trustedrelays/blob/main/ALGORITHM.md",
  },
};

function history(
  overrides: Partial<TrustedRelayObservationState> = {},
): TrustedRelayObservationState {
  return {
    url: "wss://relay.example.com",
    firstSeen: 1_700_000_000,
    lastObserved: 1_700_000_120,
    observations: 3,
    reachableObservations: 3,
    totalRttOpen: 360,
    rttOpenSamples: 3,
    totalRttRead: 450,
    rttReadSamples: 3,
    lastOnlineAt: 1_700_000_120,
    ...overrides,
  };
}

function result(overrides: Partial<RelayCheckResult> = {}): RelayCheckResult {
  return {
    url: "wss://Relay.Example.com/",
    hostname: "relay.example.com",
    protocol: "wss:",
    network: "clearnet",
    checked_at: 1_700_000_120,
    online: true,
    ignore: false,
    parent: "",
    open: { data: true, duration: 110 },
    read: { data: true, duration: 140 },
    info: {
      duration: 50,
      data: {
        name: "Example Relay",
        description: "A relay for tests",
        contact: "ops@example.com",
        pubkey: RELAY_PUBKEY,
        supported_nips: [1, 9, 11, 50],
        software: "strfry",
        version: "1.0.0",
        limitation: {
          auth_required: false,
          payment_required: false,
          max_subscriptions: 20,
          max_filters: 10,
          max_content_length: 65536,
        },
      },
    },
    geo: {
      duration: 25,
      data: {
        countryCode: "de",
        region: "Bavaria",
        isp: "Hetzner Online GmbH",
      },
    },
    ssl: {
      duration: 20,
      data: { valid: true },
    },
    ...overrides,
  } as RelayCheckResult;
}

function sample(
  observedAt: number,
  online: boolean,
  latency = 120,
) {
  return {
    url: "wss://relay.example.com",
    observedAt,
    online,
    rttOpen: latency,
    rttRead: latency + 20,
    rttWrite: latency + 40,
    network: "clearnet",
    nip11Present: true,
    operatorPubkey: RELAY_PUBKEY,
    sslValid: true,
    dnsAddress: "203.0.113.10",
    dnsAs: "Example Network",
    dnsAsn: "64500",
    countryCode: "DE",
    region: "Bavaria",
    isHosting: true,
  };
}

traTest(
  "Kind30385 - normalizeRelayUrl lowercases and removes trailing slash",
  () => {
    assertEquals(
      normalizeRelayUrl("WSS://Relay.Example.com/"),
      "wss://relay.example.com",
    );
  },
);

traTest(
  "Kind30385 - buildTrustedRelayAssertion creates evaluated assertion with NIP tags",
  () => {
    const assertion = buildTrustedRelayAssertion(result(), history(), config);

    assertEquals(assertion.relayUrl, "wss://relay.example.com");
    assertEquals(assertion.status, "evaluated");
    assertEquals(assertion.algorithm, "relaymon-local-test");
    assertEquals(assertion.operator, RELAY_PUBKEY);
    assertEquals(assertion.operatorVerified, "nip11");
    assertEquals(assertion.operatorConfidence, 70);
    assertEquals(assertion.policy, "open");
    assertEquals(assertion.countryCode, "DE");
    assertEquals(assertion.region, "Bavaria");
    assertEquals(assertion.isHosting, true);
    assertEquals(assertion.network, "clearnet");
    assertExists(assertion.score);
    assert(assertion.score >= 0 && assertion.score <= 100);
  },
);

traTest(
  "Kind30385 - defaults to RelayMon-local v2 algorithm metadata",
  () => {
    const assertion = buildTrustedRelayAssertion(
      result(),
      history(),
      {
        ...config,
        algorithm: undefined,
      },
    );

    assertEquals(assertion.algorithm, "relaymon-local-v2");
  },
);

traTest(
  "Kind30385 - insufficient observations produce insufficient_data status",
  () => {
    const assertion = buildTrustedRelayAssertion(
      result(),
      history({ observations: 1, reachableObservations: 1 }),
      config,
    );

    assertEquals(assertion.status, "insufficient_data");
    assertEquals(assertion.confidence, "low");
  },
);

traTest("Kind30385 - offline relay produces unreachable status", () => {
  const assertion = buildTrustedRelayAssertion(
    result({ online: false, open: { data: false, duration: 1000 } }),
    history({ reachableObservations: 2 }),
    config,
  );

  assertEquals(assertion.status, "unreachable");
  assertExists(assertion.score);
});

traTest(
  "Kind30385 - local outage and flapping history lowers reliability",
  () => {
    const stable = buildTrustedRelayAssertion(
      result(),
      history({
        observations: 6,
        reachableObservations: 6,
        totalRttOpen: 600,
        rttOpenSamples: 6,
        totalRttRead: 720,
        rttReadSamples: 6,
        history: [
          sample(1_700_000_000, true, 100),
          sample(1_700_000_060, true, 105),
          sample(1_700_000_120, true, 95),
          sample(1_700_000_180, true, 100),
          sample(1_700_000_240, true, 110),
          sample(1_700_000_300, true, 100),
        ],
      }),
      config,
    );
    const flapping = buildTrustedRelayAssertion(
      result({ online: false, open: { data: false, duration: 1200 } }),
      history({
        observations: 6,
        reachableObservations: 3,
        totalRttOpen: 4400,
        rttOpenSamples: 6,
        totalRttRead: 5000,
        rttReadSamples: 6,
        history: [
          sample(1_700_000_000, true, 100),
          sample(1_700_000_060, false, 900),
          sample(1_700_000_120, true, 120),
          sample(1_700_000_180, false, 1000),
          sample(1_700_000_240, true, 130),
          sample(1_700_000_300, false, 1200),
        ],
      }),
      config,
    );

    assertExists(stable.reliability);
    assertExists(flapping.reliability);
    assert(
      stable.reliability > flapping.reliability,
      "stable local history should score above flapping outage history",
    );
  },
);

traTest(
  "Kind30385 - quality uses local DNS evidence",
  () => {
    const goodDns = buildTrustedRelayAssertion(
      result({
        dns: {
          duration: 10,
          data: {
            address: "203.0.113.10",
            as: "Example Network",
            asn: 64500,
          },
        },
      }),
      history(),
      config,
    );
    const failedDns = buildTrustedRelayAssertion(
      result({
        dns: {
          duration: 10,
          data: {},
          error: new Error("dns failed"),
        },
      }),
      history(),
      config,
    );

    assertExists(goodDns.quality);
    assertExists(failedDns.quality);
    assert(
      goodDns.quality > failedDns.quality,
      "DNS evidence should affect quality scoring",
    );
  },
);

traTest(
  "Kind30385 - anonymous networks use local network knowledge for jurisdiction",
  () => {
    const assertion = buildTrustedRelayAssertion(
      result({
        url: "ws://abcdef.onion",
        hostname: "abcdef.onion",
        protocol: "ws:",
        network: "tor",
        geo: {
          duration: 25,
          data: {
            countryCode: "us",
            region: "Virginia",
          },
        },
      }),
      history(),
      config,
    );

    assertEquals(assertion.network, "tor");
    assertEquals(assertion.countryCode, "XX");
    assertEquals(assertion.region, undefined);
  },
);

traTest(
  "Kind30385 - generateEvent emits required and optional NIP tags",
  () => {
    const builder = new Kind30385(TEST_PUBKEY);
    const assertion = buildTrustedRelayAssertion(result(), history(), config);
    const event = builder.generateEvent(assertion);

    assertEquals(event.kind, 30385);
    assertEquals(event.pubkey, TEST_PUBKEY);
    assertEquals(event.content, "");
    assertEquals(
      event.tags.find((tag) => tag[0] === "d")?.[1],
      "wss://relay.example.com",
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "status")?.[1],
      "evaluated",
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "score")?.[1],
      String(assertion.score),
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "reliability")?.[1],
      String(assertion.reliability),
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "quality")?.[1],
      String(assertion.quality),
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "accessibility")?.[1],
      String(assertion.accessibility),
    );
    assertEquals(event.tags.find((tag) => tag[0] === "confidence")?.[1], "low");
    assertEquals(event.tags.find((tag) => tag[0] === "observations")?.[1], "3");
    assertEquals(
      event.tags.find((tag) => tag[0] === "operator")?.[1],
      RELAY_PUBKEY,
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "operator_verified")?.[1],
      "nip11",
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "network")?.[1],
      "clearnet",
    );
    assertEquals(
      event.tags.find((tag) => tag[0] === "client")?.[1],
      "@nostrwatch/relaymon",
    );
  },
);

traTest(
  "Kind30385 - 30385 event pubkey is the RelayMon monitor pubkey",
  () => {
    const monitorPubkey = TEST_PUBKEY;
    const builder = new Kind30385(monitorPubkey);
    const assertion = buildTrustedRelayAssertion(result(), history(), config);
    const event = builder.generateEvent(assertion);

    assertEquals(event.kind, 30385);
    assertEquals(event.pubkey, monitorPubkey);
  },
);

traTest(
  "Kind30385 - generateAndSignEvent creates verifiable event",
  async () => {
    const builder = new Kind30385(TEST_PUBKEY);
    const assertion = buildTrustedRelayAssertion(result(), history(), config);
    const signed = await builder.generateAndSignEvent(assertion, TEST_PRIVKEY);

    assertEquals(signed.kind, 30385);
    assertEquals(signed.pubkey, TEST_PUBKEY);
    assertExists(signed.id);
    assertExists(signed.sig);
    assert(verifyEvent(signed), "signed event should verify");
  },
);

traTest("Kind30385 - material change detects first publish", () => {
  const assertion = buildTrustedRelayAssertion(result(), history(), config);
  const change = hasTrustedRelayMaterialChange(assertion, null);

  assertEquals(change.changed, true);
  assertEquals(change.reason, "first_publish");
});

traTest(
  "Kind30385 - material change suppresses small score changes before refresh interval",
  () => {
    const assertion = buildTrustedRelayAssertion(result(), history(), config);
    const change = hasTrustedRelayMaterialChange(
      assertion,
      {
        status: assertion.status,
        score: assertion.score === undefined ? undefined : assertion.score - 1,
        reliability: assertion.reliability,
        quality: assertion.quality,
        accessibility: assertion.accessibility,
        confidence: assertion.confidence,
        publishedAt: 1_700_000_000,
      },
      3,
      3600000,
      1_700_000_100,
    );

    assertEquals(change.changed, false);
  },
);

traTest(
  "Kind30385 - material change detects status and threshold changes",
  () => {
    const assertion = buildTrustedRelayAssertion(result(), history(), config);

    const statusChange = hasTrustedRelayMaterialChange(assertion, {
      status: "unreachable",
      score: assertion.score,
      reliability: assertion.reliability,
      quality: assertion.quality,
      accessibility: assertion.accessibility,
      confidence: assertion.confidence,
      publishedAt: 1_700_000_000,
    });
    assertEquals(statusChange.changed, true);

    const scoreChange = hasTrustedRelayMaterialChange(assertion, {
      status: assertion.status,
      score: assertion.score === undefined ? undefined : assertion.score - 5,
      reliability: assertion.reliability,
      quality: assertion.quality,
      accessibility: assertion.accessibility,
      confidence: assertion.confidence,
      publishedAt: 1_700_000_000,
    });
    assertEquals(scoreChange.changed, true);
  },
);
