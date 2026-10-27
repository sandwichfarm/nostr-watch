import { assert, assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { parseRelayNetwork } from "npm:@nostrwatch/utils";
import { Kind30166 } from "npm:@nostrwatch/publisher";
import { isRelayCheckResult } from "../../src/types/relay.ts";

Deno.test("FIPS - classified check result passes validation and publishes network", () => {
  const result = {
    url: "ws://relay.fips:7777", hostname: "relay.fips", protocol: "ws:",
    network: parseRelayNetwork("ws://relay.fips:7777"),
    checked_at: 1_700_000_000, online: true, ignore: false, parent: "",
    open: { data: true, duration: 42 },
  };
  assertEquals(result.network, "fips");
  assert(isRelayCheckResult(result));
  const event = new Kind30166("0".repeat(64));
  assert(event.generateTags(result).some((tag) => tag[0] === "n" && tag[1] === "fips"));
});
