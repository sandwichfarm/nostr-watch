import { assert, assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { evaluateOverrides } from "../../../src/utils/dedup-overrides/evaluator.ts";

Deno.test("evaluator: returns matched:false for URL with no rule match", () => {
  const verdict = evaluateOverrides("wss://random.example.com/");
  assertEquals(verdict.matched, false);
});

Deno.test("evaluator: returns matched:true + allow for /inbox (first-match-wins = allow-known-paths)", () => {
  const verdict = evaluateOverrides("wss://haven.nostrfreedom.net/inbox/");
  assert(verdict.matched);
  if (verdict.matched) {
    assertEquals(verdict.action, "allow");
    assertEquals(verdict.rule, "allow-known-paths");
    assertEquals(verdict.reason, "known-good path");
  }
});

Deno.test("evaluator: returns matched:true + allow for lang.relays.land/en (second rule hits)", () => {
  const verdict = evaluateOverrides("wss://lang.relays.land/en");
  assert(verdict.matched);
  if (verdict.matched) {
    assertEquals(verdict.action, "allow");
    assertEquals(verdict.rule, "lang-relays-land");
    assertEquals(verdict.reason, "lang.relays.land two-letter code");
  }
});

Deno.test("evaluator: malformed URL returns matched:false without throwing", () => {
  const verdict = evaluateOverrides("not a url at all");
  assertEquals(verdict.matched, false);
});

Deno.test("evaluator: /outbox/ also hits allow-known-paths (regression)", () => {
  const verdict = evaluateOverrides("wss://haven.nostrfreedom.net/outbox/");
  assert(verdict.matched);
  if (verdict.matched) {
    assertEquals(verdict.rule, "allow-known-paths");
  }
});

Deno.test("evaluator: /inbox/flint-november falls through (mutation is NOT protected)", () => {
  const verdict = evaluateOverrides("wss://haven.nostrfreedom.net/inbox/flint-november");
  assertEquals(verdict.matched, false);
});
