import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import { Kind1066 } from "../../src/delta/kind1066.ts";
import type { Kind1066EventData } from "../../src/delta/kind1066.ts";

/**
 * Test helper to disable resource/ops sanitization
 */
function kind1066Test(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn,
  });
}

// Test pubkey (not a real key, just for testing)
const TEST_PUBKEY =
  "0000000000000000000000000000000000000000000000000000000000000001";
const TEST_PRIVKEY =
  "0000000000000000000000000000000000000000000000000000000000000001";

kind1066Test("Kind 1066: Generate online event with deltas", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://test.relay.example.com",
    online: true,
    rttOpen: 123,
    deltas: [
      { key: "name", value: "New Name", type: "change" },
      { key: "+supported_nips", value: "50", type: "add" },
      { key: "-supported_nips", value: "42", type: "remove" },
    ],
  };

  const event = builder.generateEvent(data);

  assertEquals(event.kind, 1066, "Should be kind 1066");
  assertEquals(event.pubkey, TEST_PUBKEY, "Should have correct pubkey");
  assertExists(event.created_at, "Should have created_at timestamp");
  assertEquals(event.content, "", "Content should be empty");

  // Check tags
  const tags = event.tags;
  assert(
    tags.some((t) => t[0] === "r" && t[1] === data.url),
    "Should have 'r' tag with URL",
  );
  assert(
    tags.some((t) => t[0] === "rtt-open" && t[1] === "123"),
    "Should have rtt-open tag",
  );
  assert(
    tags.some((t) => t[0] === "name" && t[1] === "New Name"),
    "Should have name change tag",
  );
  assert(
    tags.some((t) => t[0] === "+supported_nips" && t[1] === "50"),
    "Should have NIP addition tag",
  );
  assert(
    tags.some((t) => t[0] === "-supported_nips" && t[1] === "42"),
    "Should have NIP removal tag",
  );
});

kind1066Test("Kind 1066: Generate offline event with retry count", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://offline.relay.example.com",
    online: false,
    retryCount: 5,
    deltas: [
      { key: "name", value: "Should Not Appear", type: "change" },
    ],
  };

  const event = builder.generateEvent(data);

  assertEquals(event.kind, 1066, "Should be kind 1066");

  // Check tags
  const tags = event.tags;
  assert(
    tags.some((t) => t[0] === "r" && t[1] === data.url),
    "Should have 'r' tag with URL",
  );
  assert(
    tags.some((t) => t[0] === "retry" && t[1] === "5"),
    "Should have retry tag",
  );
  assert(
    !tags.some((t) => t[0] === "rtt-open"),
    "Should NOT have rtt-open for offline relay",
  );
  assert(
    !tags.some((t) => t[0] === "name"),
    "Should NOT have delta tags for offline relay",
  );
});

kind1066Test("Kind 1066: Online event without deltas", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://test.relay.example.com",
    online: true,
    rttOpen: 456,
    deltas: [], // No changes
  };

  const event = builder.generateEvent(data);

  const tags = event.tags;
  assert(tags.some((t) => t[0] === "r"), "Should have 'r' tag");
  assert(tags.some((t) => t[0] === "rtt-open"), "Should have rtt-open tag");
  assert(tags.some((t) => t[0] === "client"), "Should have client tag");
  assertEquals(
    tags.length,
    3,
    "Should only have 'r', 'rtt-open', and 'client' tags when no deltas",
  );
});

kind1066Test("Kind 1066: Online event without rtt-open", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://test.relay.example.com",
    online: true,
    // rttOpen: undefined
    deltas: [
      { key: "name", value: "Test", type: "change" },
    ],
  };

  const event = builder.generateEvent(data);

  const tags = event.tags;
  assert(
    !tags.some((t) => t[0] === "rtt-open"),
    "Should NOT have rtt-open when undefined",
  );
  assert(tags.some((t) => t[0] === "name"), "Should still have delta tags");
});

kind1066Test("Kind 1066: Offline event with retry count 0", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://test.relay.example.com",
    online: false,
    retryCount: 0,
    deltas: [],
  };

  const event = builder.generateEvent(data);

  const tags = event.tags;
  assert(
    tags.some((t) => t[0] === "retry" && t[1] === "0"),
    "Should have retry tag with 0",
  );
});

kind1066Test("Kind 1066: Event structure validation", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://test.relay.example.com",
    online: true,
    rttOpen: 100,
    deltas: [],
  };

  const event = builder.generateEvent(data);

  // Validate event structure
  assertExists(event.kind, "Should have kind");
  assertExists(event.pubkey, "Should have pubkey");
  assertExists(event.created_at, "Should have created_at");
  assertExists(event.tags, "Should have tags");
  assertExists(event.content, "Should have content");

  assert(Array.isArray(event.tags), "Tags should be an array");
  assert(typeof event.kind === "number", "Kind should be a number");
  assert(typeof event.pubkey === "string", "Pubkey should be a string");
  assert(typeof event.created_at === "number", "Created_at should be a number");
  assert(typeof event.content === "string", "Content should be a string");
});

kind1066Test("Kind 1066: Multiple delta types in one event", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://test.relay.example.com",
    online: true,
    rttOpen: 200,
    deltas: [
      { key: "name", value: "Updated Name", type: "change" },
      { key: "+contact", value: "new@example.com", type: "add" },
      { key: "-software", value: "old-software", type: "remove" },
      { key: "limitation.max_message_length", value: "5000", type: "change" },
    ],
  };

  const event = builder.generateEvent(data);

  const tags = event.tags;
  assertEquals(
    tags.filter((t) => t[0] === "name").length,
    1,
    "Should have name tag",
  );
  assertEquals(
    tags.filter((t) => t[0] === "+contact").length,
    1,
    "Should have contact addition tag",
  );
  assertEquals(
    tags.filter((t) => t[0] === "-software").length,
    1,
    "Should have software removal tag",
  );
  assertEquals(
    tags.filter((t) => t[0] === "limitation.max_message_length").length,
    1,
    "Should have nested field change tag",
  );
});

kind1066Test("Kind 1066: Operational status 'init' for first check", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://new.relay.example.com",
    online: true,
    rttOpen: 150,
    deltas: [
      { key: "+name", value: "New Relay", type: "add" },
    ],
    operationalStatus: "init",
  };

  const event = builder.generateEvent(data);

  const tags = event.tags;
  assert(
    tags.some((t) => t[0] === "O" && t[1] === "init"),
    "Should have O:init tag for first check",
  );
  assert(
    tags.some((t) => t[0] === "r" && t[1] === data.url),
    "Should have r tag",
  );
  assert(tags.some((t) => t[0] === "rtt-open"), "Should have rtt-open tag");
});

kind1066Test(
  "Kind 1066: Operational status 'down' when relay goes offline",
  () => {
    const builder = new Kind1066(TEST_PUBKEY);
    const data: Kind1066EventData = {
      url: "wss://failing.relay.example.com",
      online: false,
      retryCount: 1,
      deltas: [],
      operationalStatus: "down",
    };

    const event = builder.generateEvent(data);

    const tags = event.tags;
    assert(
      tags.some((t) => t[0] === "O" && t[1] === "down"),
      "Should have O:down tag when relay goes offline",
    );
    assert(
      tags.some((t) => t[0] === "retry" && t[1] === "1"),
      "Should have retry tag",
    );
    assert(
      !tags.some((t) => t[0] === "rtt-open"),
      "Should NOT have rtt-open when offline",
    );
  },
);

kind1066Test("Kind 1066: Operational status 'up' when relay recovers", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://recovered.relay.example.com",
    online: true,
    rttOpen: 250,
    deltas: [
      { key: "name", value: "Recovered Relay", type: "change" },
    ],
    operationalStatus: "up",
  };

  const event = builder.generateEvent(data);

  const tags = event.tags;
  assert(
    tags.some((t) => t[0] === "O" && t[1] === "up"),
    "Should have O:up tag when relay recovers",
  );
  assert(tags.some((t) => t[0] === "rtt-open"), "Should have rtt-open tag");
  assert(tags.some((t) => t[0] === "name"), "Should have delta tags");
});

kind1066Test(
  "Kind 1066: No operational status tag when no state change",
  () => {
    const builder = new Kind1066(TEST_PUBKEY);
    const data: Kind1066EventData = {
      url: "wss://stable.relay.example.com",
      online: true,
      rttOpen: 100,
      deltas: [
        { key: "name", value: "Stable Relay", type: "change" },
      ],
      // No operationalStatus = no state change
    };

    const event = builder.generateEvent(data);

    const tags = event.tags;
    assert(
      !tags.some((t) => t[0] === "O"),
      "Should NOT have O tag when no state change",
    );
    assert(tags.some((t) => t[0] === "r"), "Should have r tag");
    assert(tags.some((t) => t[0] === "rtt-open"), "Should have rtt-open tag");
  },
);

kind1066Test("Kind 1066: Operational status with period tags", () => {
  const builder = new Kind1066(TEST_PUBKEY);
  const data: Kind1066EventData = {
    url: "wss://test.relay.example.com",
    online: true,
    rttOpen: 120,
    deltas: [],
    periods: ["6h", "1d", "7d"],
    operationalStatus: "up",
  };

  const event = builder.generateEvent(data);

  const tags = event.tags;
  assert(
    tags.some((t) => t[0] === "O" && t[1] === "up"),
    "Should have O:up tag",
  );
  assert(
    tags.some((t) => t[0] === "T" && t[1] === "6h"),
    "Should have T:6h tag",
  );
  assert(
    tags.some((t) => t[0] === "T" && t[1] === "1d"),
    "Should have T:1d tag",
  );
  assert(
    tags.some((t) => t[0] === "T" && t[1] === "7d"),
    "Should have T:7d tag",
  );

  // Verify tag ordering: r, O, T, then other tags
  const rIndex = tags.findIndex((t) => t[0] === "r");
  const oIndex = tags.findIndex((t) => t[0] === "O");
  const firstTIndex = tags.findIndex((t) => t[0] === "T");

  assert(rIndex < oIndex, "r tag should come before O tag");
  assert(oIndex < firstTIndex, "O tag should come before T tags");
});

console.log("Kind 1066 tests completed");
