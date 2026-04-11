import { assert, assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { rule } from "../../../src/utils/dedup-overrides/lang-relays-land.ts";

Deno.test("lang-relays-land: rule metadata", () => {
  assertEquals(rule.name, "lang-relays-land");
  assertEquals(rule.action, "allow");
  assertEquals(rule.reason, "lang.relays.land two-letter code");
});

Deno.test("lang-relays-land: matches /en on correct host", () => {
  assert(rule.test(new URL("wss://lang.relays.land/en")));
});

Deno.test("lang-relays-land: matches /en/ with trailing slash", () => {
  assert(rule.test(new URL("wss://lang.relays.land/en/")));
});

Deno.test("lang-relays-land: matches other valid two-letter codes /fr /de /ja", () => {
  assert(rule.test(new URL("wss://lang.relays.land/fr")));
  assert(rule.test(new URL("wss://lang.relays.land/de")));
  assert(rule.test(new URL("wss://lang.relays.land/ja")));
});

Deno.test("lang-relays-land: does NOT match three-letter /eng", () => {
  assertEquals(rule.test(new URL("wss://lang.relays.land/eng")), false);
});

Deno.test("lang-relays-land: does NOT match uppercase /EN", () => {
  assertEquals(rule.test(new URL("wss://lang.relays.land/EN")), false);
});

Deno.test("lang-relays-land: does NOT match alphanumeric /e1", () => {
  assertEquals(rule.test(new URL("wss://lang.relays.land/e1")), false);
});

Deno.test("lang-relays-land: does NOT match root /", () => {
  assertEquals(rule.test(new URL("wss://lang.relays.land/")), false);
});

Deno.test("lang-relays-land: does NOT match /dashboard", () => {
  assertEquals(rule.test(new URL("wss://lang.relays.land/dashboard")), false);
});

Deno.test("lang-relays-land: does NOT match multi-segment /en/dashboard", () => {
  assertEquals(rule.test(new URL("wss://lang.relays.land/en/dashboard")), false);
});

Deno.test("lang-relays-land: does NOT match wrong hostname other.host/en", () => {
  assertEquals(rule.test(new URL("wss://other.host/en")), false);
});

Deno.test("lang-relays-land: does NOT match near-miss hostname relays.land/en", () => {
  assertEquals(rule.test(new URL("wss://relays.land/en")), false);
});
